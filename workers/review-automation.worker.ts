import { ReviewStatus } from "@prisma/client";
import { reviewsRepository } from "../repository/reviews.repo";
import { OutletRepository } from "../repository/outlet.repo";
import { ManualReviewQueueRepository } from "../repository/manual-review-queue.repo";
import { openaiService } from "../integrations/openai";
import { whatsappService } from "../integrations/whatsapp";
import { gmbService } from "../integrations/gmb";
import { logger } from "../utils/logger";
import { prisma } from "../database";

const INTERVAL_MINUTES = 15;

let intervalHandle: NodeJS.Timeout | null = null;
let lastFetchTime: Date | null = null;

const outletRepo = new OutletRepository(prisma);
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
  const outlets = await outletRepo.getEligibleOutlets();

  logger.info(`Automation: ${outlets.length} eligible outlets found`);

  for (const outlet of outlets) {
    try {
      if (!outlet.user?.googleRefreshToken || !outlet.googleLocationName) {
        logger.warn(`Outlet ${outlet.id} missing GMB auth setup`);
        continue;
      }

      const newReviews = await gmbService.fetchReviews(
        outlet.googleLocationName,
        lastFetchTime ?? undefined
      );

      if (!newReviews?.length) continue;

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

  const review = await reviewsRepository.createReview({
    outletId: outlet.id,
    rating,
    customerName: gmbReview.reviewer.displayName,
    reviewText: gmbReview.comment ?? "",
    googleReviewId: gmbReview.reviewId
  });

  if (rating >= 4) {
    await handlePositiveReview(review, outlet);
  } else {
    await handleCriticalReview(review, outlet);
  }
}

//
// -------------- STEP 2: POSITIVE REVIEWS (AUTO) ----------------
//

async function handlePositiveReview(review: any, outlet: any) {
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

async function handleCriticalReview(review: any, outlet: any) {
  try {
    logger.info(`Queuing critical review ${review.id}`);

    await manualQueueRepo.addToQueue(review.id, outlet.id);

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
    const targetUser = item.assignedAdmin ?? item.review.outlet.user;

    if (!targetUser?.whatsappNumber) continue;

    await whatsappService.sendText(
      targetUser.whatsappNumber,
      `⏰ *Reminder: manual review pending*

Outlet: ${item.review.outlet.name}
Customer: ${item.review.customerName}
Rating: ${item.review.rating}⭐

Please reply to close this review.`
    );

    await manualQueueRepo.markReminderSent(item.id);
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
