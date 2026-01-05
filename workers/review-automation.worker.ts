import { reviewsRepository } from "../repository/reviews.repo"
import { outletsRepository } from "../repository/outlets.repo"
import { openaiService } from "../integrations/openai"
import { whatsappService } from "../integrations/whatsapp"
import { gmbService } from "../integrations/gmb"
import { logger } from "../utils/logger"
import { getPrismaClient } from "../database"
import type { ReviewStatus } from "@prisma/client"

const INTERVAL_MINUTES = 15

const prisma = getPrismaClient()

let lastFetchTime: Date | null = null

async function processBatch() {
  try {
    logger.info("Automation: starting review processing batch")

    const now = new Date()

    await fetchAndProcessGMBReviews()
    await processReminderQueue()
    await processEscalations()

    lastFetchTime = now
    logger.info("Automation: review processing batch complete")
  } catch (err) {
    logger.error("Automation: batch failed", err)
  }
}

async function fetchAndProcessGMBReviews() {
  try {
    const activeOutlets = await outletsRepository.getActiveOutlets()
    logger.info(`Processing ${activeOutlets.length} active outlets`)

    for (const outlet of activeOutlets) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: outlet.userId },
        })

        if (!user?.googleRefreshToken || !outlet.googleLocationName) {
          logger.warn(`Outlet ${outlet.id} missing GMB credentials`)
          continue
        }

        const gmbReviews = await gmbService.fetchReviews(
          outlet.googleLocationName,
          lastFetchTime || undefined
        )

        if (!gmbReviews || gmbReviews.length === 0) {
          continue
        }

        logger.info(`Fetched ${gmbReviews.length} new reviews for outlet ${outlet.id}`)

        for (const gmbReview of gmbReviews) {
          const existingReview = await prisma.review.findFirst({
            where: {
              outletId: outlet.id,
              customerName: gmbReview.reviewer.displayName,
              rating: gmbService.ratingToNumber(gmbReview.starRating),
            },
          })

          if (existingReview) {
            logger.info(`Review ${gmbReview.reviewId} already exists, skipping`)
            continue
          }

          const ratingNumber = gmbService.ratingToNumber(gmbReview.starRating)

          const review = await reviewsRepository.createReview({
            outletId: outlet.id,
            rating: ratingNumber,
            customerName: gmbReview.reviewer.displayName,
            reviewText: gmbReview.comment || "",
          })

          logger.info(`Created review ${review.id} with rating ${ratingNumber}`)

          if (ratingNumber >= 4) {
            await handlePositiveReview(review, outlet, user)
          } else {
            await handleCriticalReview(review, outlet, user)
          }
        }
      } catch (error) {
        logger.error(`Failed to process outlet ${outlet.id}`, error)
      }
    }
  } catch (error) {
    logger.error("Failed to fetch GMB reviews", error)
  }
}

async function handlePositiveReview(review: any, outlet: any, user: any) {
  try {
    logger.info(`Handling positive review ${review.id} (${review.rating} stars)`)

    const aiReply = await openaiService.generateReply(
      review.reviewText,
      review.rating,
      outlet.name
    )

    if (!aiReply) {
      logger.error(`Failed to generate AI reply for review ${review.id}`)
      return
    }

    await reviewsRepository.updateReview(review.id, {
      aiReplyText: aiReply,
      status: "AUTO_REPLIED" as ReviewStatus,
    })

    const posted = await gmbService.postReply(
      outlet.googleLocationName,
      review.customerName,
      aiReply,
      user.googleRefreshToken
    )

    if (posted) {
      logger.info(`Posted AI reply to GMB for review ${review.id}`)

      if (user.whatsappNumber) {
        await whatsappService.sendText(
          user.whatsappNumber,
          `Positive Review Received!\n\nOutlet: ${outlet.name}\nRating: ${review.rating} stars\nCustomer: ${review.customerName}\n\nOur AI has automatically replied: "${aiReply.substring(0, 100)}${aiReply.length > 100 ? "..." : ""}"`
        )
      }

      await reviewsRepository.updateReview(review.id, {
        status: "CLOSED" as ReviewStatus,
      })

      logger.info(`Closed review ${review.id} after successful AI reply`)
    } else {
      logger.error(`Failed to post AI reply to GMB for review ${review.id}`)
    }
  } catch (error) {
    logger.error(`Error handling positive review ${review.id}`, error)
  }
}

async function handleCriticalReview(review: any, outlet: any, user: any) {
  try {
    logger.info(`Handling critical review ${review.id} (${review.rating} stars)`)

    await reviewsRepository.updateReview(review.id, {
      status: "ESCALATED" as ReviewStatus,
    })

    logger.info(`Marked review ${review.id} as escalated`)

    if (user.whatsappNumber) {
      await whatsappService.sendText(
        user.whatsappNumber,
        `CRITICAL REVIEW ALERT\n\nOutlet: ${outlet.name}\nRating: ${review.rating} stars\nCustomer: ${review.customerName}\nMessage: ${review.reviewText}\n\nPlease respond ASAP.`
      )

      logger.info(`Sent critical review alert to ${user.whatsappNumber}`)
    } else {
      logger.warn(`No WhatsApp number configured for outlet ${outlet.id}`)
    }
  } catch (error) {
    logger.error(`Error handling critical review ${review.id}`, error)
  }
}

async function processReminderQueue() {
  try {
    const escalatedReviews = await reviewsRepository.getEscalatedReviews(100)

    if (escalatedReviews.length === 0) {
      return
    }

    logger.info(`Processing ${escalatedReviews.length} escalated reviews`)

    for (const review of escalatedReviews) {
      try {
        const outlet = await outletsRepository.getOutletById(review.outletId)
        if (!outlet) continue

        const user = await prisma.user.findUnique({
          where: { id: outlet.userId },
        })

        if (user?.whatsappNumber) {
          await whatsappService.sendText(
            user.whatsappNumber,
            `Reminder: Escalated review for ${outlet.name} from ${review.customerName} (${review.rating} stars) is still pending.`
          )

          logger.info(`Sent reminder for review ${review.id}`)
        }
      } catch (error) {
        logger.error(`Failed to process reminder for review ${review.id}`, error)
      }
    }
  } catch (error) {
    logger.error("Failed to process reminder queue", error)
  }
}

async function processEscalations() {
  try {
    const escalatedReviews = await prisma.review.findMany({
      where: {
        status: "ESCALATED",
        createdAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      include: { outlet: true },
    })

    if (escalatedReviews.length === 0) {
      return
    }

    logger.info(`Processing ${escalatedReviews.length} escalated reviews`)

    for (const review of escalatedReviews) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: review.outlet.userId },
        })

        if (user?.whatsappNumber) {
          await whatsappService.sendText(
            user.whatsappNumber,
            `ESCALATION: Review for ${review.outlet.name} from ${review.customerName} has been pending for 24+ hours.`
          )

          logger.info(`Sent escalation notice for review ${review.id}`)
        }
      } catch (error) {
        logger.error(`Failed to process escalation for review ${review.id}`, error)
      }
    }
  } catch (error) {
    logger.error("Failed to process escalations", error)
  }
}

export function startAutomation() {
  if (process.env.AUTOMATION_ENABLED !== "true") {
    logger.info("Automation worker disabled (AUTOMATION_ENABLED != true)")
    return
  }

  logger.info(`Starting automation worker: interval ${INTERVAL_MINUTES} minutes`)

  processBatch().catch((e) => logger.error("Automation initial run failed", e))

  setInterval(
    () => {
      processBatch().catch((e) => logger.error("Automation batch failed", e))
    },
    INTERVAL_MINUTES * 60 * 1000
  )
}

export default { startAutomation }
