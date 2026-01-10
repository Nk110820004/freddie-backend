import { ReviewStatus } from "@prisma/client";
import { reviewsRepository } from "../repository/reviews.repo";
import { outletsRepository } from "../repository/outlets.repo";
import { ManualReviewQueueRepository } from "../repository/manual-review-queue.repo";
import { reviewWorkflowRepository, ReviewWorkflowState } from "../repository/review-workflow.repo";
import { openaiService } from "../integrations/openai";
import { whatsappService } from "../integrations/whatsapp";
import { gmbService } from "../integrations/gmb";
import { logger } from "../utils/logger";
import { prisma } from "../database";

const INTERVAL_MINUTES = 15;

let intervalHandle: NodeJS.Timeout | null = null;
let lastFetchTime: Date | null = null;

const outletRepo = outletsRepository;
const manualQueueRepo = new ManualReviewQueueRepository(prisma);

//
// -------------- MAIN PERIODIC BATCH ----------------
//

async function processBatch() {
  try {
    logger.info("Automation: starting review processing batch");

    await fetchAndProcessGMBReviews();
    await processManualReviewReminders();

    lastFetchTime = new Date();

    logger.info("Automation: batch complete");
  } catch (err) {
    logger.error("Automation batch failed", err);
  }
}

//
// -------------- STEP 1: FETCH & CLASSIFY REVIEWS ----------------
//

async function fetchAndProcessGMBReviews() {
  const allOutlets = await prisma.outlet.findMany({
    where: {
      apiStatus: "ENABLED",
      onboardingStatus: "COMPLETED",
    },
    include: {
      user: {
        select: {
          googleRefreshToken: true,
          whatsappNumber: true,
        },
      },
    },
  });

  // CRITICAL: Filter by strict eligibility criteria before polling
  const eligibleOutlets = allOutlets.filter((outlet: any) => {
    if (outlet.subscriptionStatus !== "ACTIVE") {
      logger.warn(`Outlet ${outlet.id} subscription not active`);
      return false;
    }
    return true;
  });

  logger.info(`Automation: ${eligibleOutlets.length}/${allOutlets.length} outlets eligible for polling`);

  for (const outlet of eligibleOutlets) {
    try {
      if (!outlet.user?.googleRefreshToken || !outlet.googleLocationName) {
        logger.warn(`Outlet ${outlet.id} missing GMB auth setup`);
        continue;
      }

      const newReviews = await gmbService.fetchReviews(
        outlet.googleLocationName,
        lastFetchTime ?? undefined
      );

      if (!newReviews?.length) {
        logger.debug(`No new reviews for outlet ${outlet.id}`);
        continue;
      }

      logger.info(
        `Fetched ${newReviews.length} new reviews for outlet ${outlet.id}`
      );

      for (const r of newReviews) {
        await processSingleReview(r, outlet);
      }
    } catch (err) {
      logger.error(`Error processing outlet ${outlet.id}`, err);
    }
  }
}

//
// -------------- STEP 1A: PROCESS INDIVIDUAL REVIEW ----------------
//

async function processSingleReview(gmbReview: any, outlet: any) {
  const rating = gmbService.ratingToNumber(gmbReview.starRating);

  // idempotency on googleReviewId
  const exists = await prisma.review.findFirst({
    where: { googleReviewId: gmbReview.reviewId }
  });

  if (exists) {
    logger.info(`Review ${gmbReview.reviewId} already processed`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const review = await reviewsRepository.createReview({
      outletId: outlet.id,
      rating,
      customerName: gmbReview.reviewer.displayName,
      reviewText: gmbReview.comment ?? "",
      googleReviewId: gmbReview.reviewId
    });

    // Initialize workflow
    await reviewWorkflowRepository.createIfNotExists(review.id);

    if (rating >= 4) {
      await handlePositiveReview(review, outlet, tx);
    } else {
      await handleCriticalReview(review, outlet, tx);
    }
  });
}

//
// -------------- STEP 2: POSITIVE REVIEWS (AUTO) ----------------
//

async function handlePositiveReview(review: any, outlet: any, tx?: any) {
  try {
    logger.info(`Auto-handling positive review ${review.id}`);

    const aiReply = await openaiService.generateReply(
      review.reviewText,
      review.rating,
      outlet.name
    );

    if (!aiReply) {
      logger.error(`AI reply generation failed for review ${review.id}`);
      return;
    }

    await reviewsRepository.markAsAutoReplied(review.id, aiReply);
    await reviewWorkflowRepository.updateState(review.id, ReviewWorkflowState.AUTO_REPLIED, tx);

    const posted = await gmbService.postReply(
      outlet.googleLocationName,
      review.googleReviewId,
      aiReply,
      outlet.user.googleRefreshToken
    );

    if (!posted) {
      logger.error(`Failed to post AI reply for review ${review.id}`);
      return;
    }

    await reviewsRepository.markAsClosed(review.id);
    await reviewWorkflowRepository.complete(review.id);

    if (outlet.user?.whatsappNumber) {
      await whatsappService.sendText(
        outlet.user.whatsappNumber,
        `✨ *Positive review auto-replied*

Outlet: ${outlet.name}
Rating: ${review.rating}⭐
Customer: ${review.customerName}

Reply sent:
"${aiReply}"`
      );
    }
  } catch (err) {
    logger.error(`handlePositiveReview failed`, err);
  }
}

//
// -------------- STEP 3: CRITICAL REVIEWS (MANUAL) ----------------
//

async function handleCriticalReview(review: any, outlet: any, tx?: any) {
  try {
    logger.info(`Queuing critical review ${review.id}`);

    await manualQueueRepo.addToQueue(review.id, outlet.id);
    
    // Calculate first reminder (15 mins from now)
    const firstReminder = new Date(Date.now() + 15 * 60 * 1000);
    await reviewWorkflowRepository.moveToManualQueue(review.id, firstReminder, tx);

    if (outlet.user?.whatsappNumber) {
      await whatsappService.sendText(
        outlet.user.whatsappNumber,
        `⚠️ *Critical review received*

Outlet: ${outlet.name}
Rating: ${review.rating}⭐
Customer: ${review.customerName}

"${review.reviewText}"

Please respond manually.`
      );
    }
  } catch (err) {
    logger.error(`handleCriticalReview failed`, err);
  }
}

//
// -------------- STEP 4: REMINDERS ----------------
//

async function processManualReviewReminders() {
  const due = await manualQueueRepo.getPendingReminders();

  if (!due.length) return;

  logger.info(`Sending ${due.length} manual-review reminders`);

  for (const item of due) {
    try {
      const wf = await reviewWorkflowRepository.getByReviewId(item.reviewId);
      if (!wf) {
        logger.warn(`Workflow not found for review ${item.reviewId}`);
        continue;
      }

      if (wf.currentState === ReviewWorkflowState.ESCALATED || wf.currentState === ReviewWorkflowState.COMPLETED) {
        logger.debug(`Review ${item.reviewId} already in final state ${wf.currentState}`);
        continue;
      }

      const targetUser = item.assignedAdmin ?? item.review.outlet.user;

      if (!targetUser?.whatsappNumber) {
        logger.warn(`No WhatsApp number for outlet ${item.review.outletId}`);
        const updated = await manualQueueRepo.updateReminderSent(item.id);
        if (updated.status === "ESCALATED") {
          await reviewWorkflowRepository.updateState(item.reviewId, ReviewWorkflowState.ESCALATED);
          logger.info(`Review ${item.reviewId} escalated (no WhatsApp channel)`);
        }
        continue;
      }

      await whatsappService.sendText(
        targetUser.whatsappNumber,
        `⏰ *Reminder: manual review pending*\n\nOutlet: ${item.review.outlet.name}\nCustomer: ${item.review.customerName}\nRating: ${item.review.rating}⭐\nReminder #${item.reminderCount + 1}\n\nPlease respond to close this review.`
      );

      const updated = await manualQueueRepo.updateReminderSent(item.id);

      if (updated.status === "ESCALATED") {
        await reviewWorkflowRepository.updateState(item.reviewId, ReviewWorkflowState.ESCALATED);
        logger.info(`Review ${item.reviewId} escalated after max reminders`);
      } else if (updated.nextReminderAt) {
        await reviewWorkflowRepository.incrementReminder(item.reviewId, updated.nextReminderAt);
      }
    } catch (err) {
      logger.error(`Failed to process reminder for item ${item.id}`, err);
    }
  }
}

//
// -------------- START / STOP ----------------
//

export async function startAutomation() {
  if (process.env.AUTOMATION_ENABLED !== "true") {
    logger.info("Automation worker disabled");
    return;
  }

  if (intervalHandle) return;

  logger.info(
    `Automation worker enabled. Interval: ${INTERVAL_MINUTES} minutes`
  );

  await processBatch();

  intervalHandle = setInterval(
    () => processBatch(),
    INTERVAL_MINUTES * 60 * 1000
  );
}

export async function stopAutomation() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info("Automation worker stopped");
  }
}
// -------------- START / STOP ----------------
