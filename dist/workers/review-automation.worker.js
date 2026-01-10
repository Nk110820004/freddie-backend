"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAutomation = startAutomation;
exports.stopAutomation = stopAutomation;
const reviews_repo_1 = require("../repository/reviews.repo");
const outlets_repo_1 = require("../repository/outlets.repo");
const manual_review_queue_repo_1 = require("../repository/manual-review-queue.repo");
const review_workflow_repo_1 = require("../repository/review-workflow.repo");
const openai_1 = require("../integrations/openai");
const whatsapp_1 = require("../integrations/whatsapp");
const gmb_1 = require("../integrations/gmb");
const logger_1 = require("../utils/logger");
const database_1 = require("../database");
const INTERVAL_MINUTES = 15;
let intervalHandle = null;
let lastFetchTime = null;
const outletRepo = outlets_repo_1.outletsRepository;
const manualQueueRepo = new manual_review_queue_repo_1.ManualReviewQueueRepository(database_1.prisma);
//
// -------------- MAIN PERIODIC BATCH ----------------
//
async function processBatch() {
    try {
        logger_1.logger.info("Automation: starting review processing batch");
        await fetchAndProcessGMBReviews();
        await processManualReviewReminders();
        lastFetchTime = new Date();
        logger_1.logger.info("Automation: batch complete");
    }
    catch (err) {
        logger_1.logger.error("Automation batch failed", err);
    }
}
//
// -------------- STEP 1: FETCH & CLASSIFY REVIEWS ----------------
//
async function fetchAndProcessGMBReviews() {
    const allOutlets = await database_1.prisma.outlet.findMany({
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
    const eligibleOutlets = allOutlets.filter((outlet) => {
        if (outlet.subscriptionStatus !== "ACTIVE") {
            logger_1.logger.warn(`Outlet ${outlet.id} subscription not active`);
            return false;
        }
        return true;
    });
    logger_1.logger.info(`Automation: ${eligibleOutlets.length}/${allOutlets.length} outlets eligible for polling`);
    for (const outlet of eligibleOutlets) {
        try {
            if (!outlet.user?.googleRefreshToken || !outlet.googleLocationName) {
                logger_1.logger.warn(`Outlet ${outlet.id} missing GMB auth setup`);
                continue;
            }
            const newReviews = await gmb_1.gmbService.fetchReviews(outlet.googleLocationName, lastFetchTime ?? undefined);
            if (!newReviews?.length) {
                logger_1.logger.debug(`No new reviews for outlet ${outlet.id}`);
                continue;
            }
            logger_1.logger.info(`Fetched ${newReviews.length} new reviews for outlet ${outlet.id}`);
            for (const r of newReviews) {
                await processSingleReview(r, outlet);
            }
        }
        catch (err) {
            logger_1.logger.error(`Error processing outlet ${outlet.id}`, err);
        }
    }
}
//
// -------------- STEP 1A: PROCESS INDIVIDUAL REVIEW ----------------
//
async function processSingleReview(gmbReview, outlet) {
    const rating = gmb_1.gmbService.ratingToNumber(gmbReview.starRating);
    // idempotency on googleReviewId
    const exists = await database_1.prisma.review.findFirst({
        where: { googleReviewId: gmbReview.reviewId }
    });
    if (exists) {
        logger_1.logger.info(`Review ${gmbReview.reviewId} already processed`);
        return;
    }
    await database_1.prisma.$transaction(async (tx) => {
        const review = await reviews_repo_1.reviewsRepository.createReview({
            outletId: outlet.id,
            rating,
            customerName: gmbReview.reviewer.displayName,
            reviewText: gmbReview.comment ?? "",
            googleReviewId: gmbReview.reviewId
        });
        // Initialize workflow
        await review_workflow_repo_1.reviewWorkflowRepository.createIfNotExists(review.id);
        if (rating >= 4) {
            await handlePositiveReview(review, outlet, tx);
        }
        else {
            await handleCriticalReview(review, outlet, tx);
        }
    });
}
//
// -------------- STEP 2: POSITIVE REVIEWS (AUTO) ----------------
//
async function handlePositiveReview(review, outlet, tx) {
    try {
        logger_1.logger.info(`Auto-handling positive review ${review.id}`);
        const aiReply = await openai_1.openaiService.generateReply(review.reviewText, review.rating, outlet.name);
        if (!aiReply) {
            logger_1.logger.error(`AI reply generation failed for review ${review.id}`);
            return;
        }
        await reviews_repo_1.reviewsRepository.markAsAutoReplied(review.id, aiReply);
        await review_workflow_repo_1.reviewWorkflowRepository.updateState(review.id, review_workflow_repo_1.ReviewWorkflowState.AUTO_REPLIED, tx);
        const posted = await gmb_1.gmbService.postReply(outlet.googleLocationName, review.googleReviewId, aiReply, outlet.user.googleRefreshToken);
        if (!posted) {
            logger_1.logger.error(`Failed to post AI reply for review ${review.id}`);
            return;
        }
        await reviews_repo_1.reviewsRepository.markAsClosed(review.id);
        await review_workflow_repo_1.reviewWorkflowRepository.complete(review.id);
        if (outlet.user?.whatsappNumber) {
            await whatsapp_1.whatsappService.sendText(outlet.user.whatsappNumber, `✨ *Positive review auto-replied*

Outlet: ${outlet.name}
Rating: ${review.rating}⭐
Customer: ${review.customerName}

Reply sent:
"${aiReply}"`);
        }
    }
    catch (err) {
        logger_1.logger.error(`handlePositiveReview failed`, err);
    }
}
//
// -------------- STEP 3: CRITICAL REVIEWS (MANUAL) ----------------
//
async function handleCriticalReview(review, outlet, tx) {
    try {
        logger_1.logger.info(`Queuing critical review ${review.id}`);
        await manualQueueRepo.addToQueue(review.id, outlet.id);
        // Calculate first reminder (15 mins from now)
        const firstReminder = new Date(Date.now() + 15 * 60 * 1000);
        await review_workflow_repo_1.reviewWorkflowRepository.moveToManualQueue(review.id, firstReminder, tx);
        if (outlet.user?.whatsappNumber) {
            await whatsapp_1.whatsappService.sendText(outlet.user.whatsappNumber, `⚠️ *Critical review received*

Outlet: ${outlet.name}
Rating: ${review.rating}⭐
Customer: ${review.customerName}

"${review.reviewText}"

Please respond manually.`);
        }
    }
    catch (err) {
        logger_1.logger.error(`handleCriticalReview failed`, err);
    }
}
//
// -------------- STEP 4: REMINDERS ----------------
//
async function processManualReviewReminders() {
    const due = await manualQueueRepo.getPendingReminders();
    if (!due.length)
        return;
    logger_1.logger.info(`Sending ${due.length} manual-review reminders`);
    for (const item of due) {
        try {
            const wf = await review_workflow_repo_1.reviewWorkflowRepository.getByReviewId(item.reviewId);
            if (!wf) {
                logger_1.logger.warn(`Workflow not found for review ${item.reviewId}`);
                continue;
            }
            if (wf.currentState === review_workflow_repo_1.ReviewWorkflowState.ESCALATED || wf.currentState === review_workflow_repo_1.ReviewWorkflowState.COMPLETED) {
                logger_1.logger.debug(`Review ${item.reviewId} already in final state ${wf.currentState}`);
                continue;
            }
            const targetUser = item.assignedAdmin ?? item.review.outlet.user;
            if (!targetUser?.whatsappNumber) {
                logger_1.logger.warn(`No WhatsApp number for outlet ${item.review.outletId}`);
                const updated = await manualQueueRepo.updateReminderSent(item.id);
                if (updated.status === "ESCALATED") {
                    await review_workflow_repo_1.reviewWorkflowRepository.updateState(item.reviewId, review_workflow_repo_1.ReviewWorkflowState.ESCALATED);
                    logger_1.logger.info(`Review ${item.reviewId} escalated (no WhatsApp channel)`);
                }
                continue;
            }
            await whatsapp_1.whatsappService.sendText(targetUser.whatsappNumber, `⏰ *Reminder: manual review pending*\n\nOutlet: ${item.review.outlet.name}\nCustomer: ${item.review.customerName}\nRating: ${item.review.rating}⭐\nReminder #${item.reminderCount + 1}\n\nPlease respond to close this review.`);
            const updated = await manualQueueRepo.updateReminderSent(item.id);
            if (updated.status === "ESCALATED") {
                await review_workflow_repo_1.reviewWorkflowRepository.updateState(item.reviewId, review_workflow_repo_1.ReviewWorkflowState.ESCALATED);
                logger_1.logger.info(`Review ${item.reviewId} escalated after max reminders`);
            }
            else if (updated.nextReminderAt) {
                await review_workflow_repo_1.reviewWorkflowRepository.incrementReminder(item.reviewId, updated.nextReminderAt);
            }
        }
        catch (err) {
            logger_1.logger.error(`Failed to process reminder for item ${item.id}`, err);
        }
    }
}
//
// -------------- START / STOP ----------------
//
async function startAutomation() {
    if (process.env.AUTOMATION_ENABLED !== "true") {
        logger_1.logger.info("Automation worker disabled");
        return;
    }
    if (intervalHandle)
        return;
    logger_1.logger.info(`Automation worker enabled. Interval: ${INTERVAL_MINUTES} minutes`);
    await processBatch();
    intervalHandle = setInterval(() => processBatch(), INTERVAL_MINUTES * 60 * 1000);
}
async function stopAutomation() {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
        logger_1.logger.info("Automation worker stopped");
    }
}
// -------------- START / STOP ----------------
//# sourceMappingURL=review-automation.worker.js.map