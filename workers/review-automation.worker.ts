import { reviewsRepository } from "../repository/reviews.repo"
import { openaiService } from "../integrations/openai"
import { whatsappService } from "../integrations/whatsapp"
import { gmbService } from "../integrations/gmb"
import { logger } from "../utils/logger"
import { OutletRepository } from "../repository/outlet.repo"
import { ManualReviewQueueRepository } from "../repository/manual-review-queue.repo"
import { prisma } from "../lib/prisma"
import { ReviewStatus } from "@prisma/client"

const INTERVAL_MINUTES = 15
const MAX_REMINDERS = 5

const outletRepo = new OutletRepository(prisma)
const manualQueueRepo = new ManualReviewQueueRepository(prisma)

let lastFetchTime: Date | null = null

/**
 * Main automation batch processor
 * Runs every 15 minutes to:
 * 1. Fetch new GMB reviews
 * 2. Process rating-based branching (4-5 auto, 1-3 manual)
 * 3. Send WhatsApp reminders for pending manual reviews
 * 4. Check and disable expired trial subscriptions
 */
async function processBatch() {
  try {
    logger.info("Automation: starting review processing batch")

    const now = new Date()

    // Step 1: Fetch new reviews from GMB for eligible outlets
    await fetchAndProcessGMBReviews()

    // Step 2: Process pending reminder queue
    await processReminderQueue()

    // Step 3: Check for escalations (reviews pending > 24 hours)
    await processEscalations()

    // Step 4: Clean up expired trials
    await outletRepo.checkAndDisableExpiredTrials()

    // Update last fetch time
    lastFetchTime = now

    logger.info("Automation: review processing batch complete")
  } catch (err) {
    logger.error("Automation: batch failed", err)
  }
}

/**
 * Fetch new reviews from GMB and apply rating logic
 */
async function fetchAndProcessGMBReviews() {
  const activeOutlets = await outletRepo.getEligibleOutlets()

  logger.info(`Processing ${activeOutlets.length} eligible outlets`)

  for (const outlet of activeOutlets) {
    try {
      if (!outlet.user?.googleRefreshToken || !outlet.googleLocationName) {
        logger.warn(`Outlet ${outlet.id} missing GMB credentials`)
        continue
      }

      // Fetch reviews (only new ones if lastFetchTime exists)
      const gmbReviews = await gmbService.fetchReviews(outlet.googleLocationName, lastFetchTime || undefined)

      if (!gmbReviews || gmbReviews.length === 0) {
        continue
      }

      logger.info(`Fetched ${gmbReviews.length} new reviews for outlet ${outlet.id}`)

      for (const gmbReview of gmbReviews) {
        // Check if review already exists
        const existingReview = await reviewsRepository.findByGoogleId(gmbReview.reviewId)
        if (existingReview) {
          logger.info(`Review ${gmbReview.reviewId} already exists, skipping`)
          continue
        }

        const ratingNumber = gmbService.ratingToNumber(gmbReview.starRating)

        // Create review in database
        const review = await reviewsRepository.createReview({
          googleReviewId: gmbReview.reviewId,
          rating: ratingNumber,
          customerName: gmbReview.reviewer.displayName,
          reviewText: gmbReview.comment || "",
          outletId: outlet.id,
          status: ReviewStatus.PENDING,
        })

        logger.info(`Created review ${review.id} with rating ${ratingNumber}`)

        // RATING BRANCHING LOGIC
        if (ratingNumber >= 4) {
          await handlePositiveReview(review, outlet)
        } else {
          await handleCriticalReview(review, outlet)
        }
      }
    } catch (error) {
      logger.error(`Failed to process outlet ${outlet.id}`, error)
    }
  }
}

/**
 * Handle positive reviews (4-5 stars) with AI auto-reply
 */
async function handlePositiveReview(review: any, outlet: any) {
  try {
    logger.info(`Handling positive review ${review.id} (${review.rating} stars)`)

    // Generate AI reply
    const aiReply = await openaiService.generateReply(review.reviewText, review.rating, outlet.name)

    if (!aiReply) {
      logger.error(`Failed to generate AI reply for review ${review.id}`)
      return
    }

    // Update review with AI reply
    await reviewsRepository.updateReview(review.id, {
      aiReplyText: aiReply,
      status: ReviewStatus.AUTO_REPLIED,
    })

    // Post reply to GMB
    const posted = await gmbService.postReply(
      outlet.googleLocationName,
      review.googleReviewId,
      aiReply,
      outlet.user.googleRefreshToken,
    )

    if (posted) {
      logger.info(`Posted AI reply to GMB for review ${review.id}`)

      // Send WhatsApp notification to outlet owner
      if (outlet.user.whatsappNumber) {
        await whatsappService.sendText(
          outlet.user.whatsappNumber,
          `Positive Review Received!\n\nOutlet: ${outlet.name}\nRating: ${review.rating} stars\nCustomer: ${review.customerName}\n\nOur AI has automatically replied: "${aiReply.substring(0, 100)}${aiReply.length > 100 ? "..." : ""}"`,
        )
      }

      // Mark as CLOSED and flush the review data as requested
      await reviewsRepository.updateReview(review.id, {
        status: ReviewStatus.CLOSED,
      })

      // Flush review data after successful WhatsApp notification
      await reviewsRepository.deleteReview(review.id)
      logger.info(`Flushed review ${review.id} after successful AI reply and notification`)
    } else {
      logger.error(`Failed to post AI reply to GMB for review ${review.id}`)
    }
  } catch (error) {
    logger.error(`Error handling positive review ${review.id}`, error)
  }
}

/**
 * Handle critical reviews (1-3 stars) requiring manual reply
 */
async function handleCriticalReview(review: any, outlet: any) {
  try {
    logger.info(`Handling critical review ${review.id} (${review.rating} stars)`)

    // Update review status to manual pending
    await reviewsRepository.updateReview(review.id, {
      status: ReviewStatus.MANUAL_PENDING,
    })

    // Add to manual review queue
    await manualQueueRepo.addToQueue(review.id, outlet.id, outlet.userId)

    logger.info(`Added review ${review.id} to manual queue`)

    // Send WhatsApp alert to admin/outlet owner
    if (outlet.user.whatsappNumber) {
      await whatsappService.sendCriticalReviewAlert(
        outlet.user.whatsappNumber,
        outlet.name,
        review.rating,
        review.customerName,
        review.reviewText,
      )

      logger.info(`Sent critical review alert to ${outlet.user.whatsappNumber}`)
    } else {
      logger.warn(`No WhatsApp number configured for outlet ${outlet.id}`)
    }
  } catch (error) {
    logger.error(`Error handling critical review ${review.id}`, error)
  }
}

/**
 * Process reminder queue - send reminders at intervals
 * Intervals: 15min, 2h, 6h, 12h, 24h
 */
async function processReminderQueue() {
  try {
    const pendingReminders = await manualQueueRepo.getPendingReminders()

    logger.info(`Processing ${pendingReminders.length} pending reminders`)

    for (const queueItem of pendingReminders) {
      try {
        const review = queueItem.review as any
        const outlet = review?.outlet
        const targetNumber = queueItem.assignedAdmin?.whatsappNumber || outlet?.user?.whatsappNumber

        if (!targetNumber) {
          logger.warn(`No WhatsApp number for queue item ${queueItem.id}`)
          continue
        }

        // Send reminder
        await whatsappService.sendManualReviewReminder(
          targetNumber,
          outlet.name,
          review.customerName,
          review.rating,
          queueItem.reminderCount + 1,
        )

        // Update reminder count and schedule next reminder
        await manualQueueRepo.updateReminderSent(queueItem.id)

        logger.info(`Sent reminder #${queueItem.reminderCount + 1} for review ${review.id} to ${targetNumber}`)
      } catch (error) {
        logger.error(`Failed to process reminder for queue item ${queueItem.id}`, error)
      }
    }
  } catch (error) {
    logger.error("Failed to process reminder queue", error)
  }
}

/**
 * Process escalations - reviews that exceeded max reminders
 */
async function processEscalations() {
  try {
    const escalatedReviews = await manualQueueRepo.getEscalatedReviews()

    if (escalatedReviews.length === 0) {
      return
    }

    logger.info(`Processing ${escalatedReviews.length} escalated reviews`)

    for (const escalation of escalatedReviews) {
      try {
        const review = escalation.review as any
        const outlet = review?.outlet
        const hoursPending = Math.floor((Date.now() - new Date(escalation.createdAt).getTime()) / (1000 * 60 * 60))

        // Send escalation notice
        const targetNumber = escalation.assignedAdmin?.whatsappNumber || outlet?.user?.whatsappNumber

        if (targetNumber) {
          await whatsappService.sendEscalationNotice(
            targetNumber,
            outlet.name,
            review.customerName,
            review.rating,
            hoursPending,
          )

          logger.info(`Sent escalation notice for review ${review.id}`)
        }

        // Notify super admins
        const superAdmins = await prisma.user.findMany({
          where: {
            role: "SUPER_ADMIN",
            whatsappNumber: { not: null },
          },
          select: {
            whatsappNumber: true,
          },
        })

        const superAdminNumbers = superAdmins.map((a) => a.whatsappNumber).filter(Boolean) as string[]

        if (superAdminNumbers.length > 0) {
          await whatsappService.notifyAdmins(
            superAdminNumbers,
            `ESCALATION: Review for ${outlet.name} from ${review.customerName} (${review.rating} stars) has been pending for ${hoursPending} hours with no response.`,
          )
        }
      } catch (error) {
        logger.error(`Failed to process escalation ${escalation.id}`, error)
      }
    }
  } catch (error) {
    logger.error("Failed to process escalations", error)
  }
}

/**
 * Start the automation worker
 */
export function startAutomation() {
  if (process.env.AUTOMATION_ENABLED !== "true") {
    logger.info("Automation worker disabled (AUTOMATION_ENABLED != true)")
    return
  }

  logger.info(`Starting automation worker: interval ${INTERVAL_MINUTES} minutes`)

  // Run immediately on startup
  processBatch().catch((e) => logger.error("Automation initial run failed", e))

  // Schedule recurring runs
  setInterval(
    () => {
      processBatch().catch((e) => logger.error("Automation batch failed", e))
    },
    INTERVAL_MINUTES * 60 * 1000,
  )
}

export default { startAutomation }
