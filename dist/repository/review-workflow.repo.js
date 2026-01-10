"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewWorkflowRepository = exports.ReviewWorkflowRepository = exports.ReviewWorkflowState = void 0;
const database_1 = require("../database");
var ReviewWorkflowState;
(function (ReviewWorkflowState) {
    ReviewWorkflowState["PENDING"] = "PENDING";
    ReviewWorkflowState["AUTO_REPLIED"] = "AUTO_REPLIED";
    ReviewWorkflowState["MANUAL_PENDING"] = "MANUAL_PENDING";
    ReviewWorkflowState["COMPLETED"] = "COMPLETED";
    ReviewWorkflowState["ESCALATED"] = "ESCALATED";
})(ReviewWorkflowState || (exports.ReviewWorkflowState = ReviewWorkflowState = {}));
class ReviewWorkflowRepository {
    /**
     * Fetch by reviewId
     */
    async getByReviewId(reviewId) {
        return database_1.prisma.reviewWorkflow.findUnique({
            where: { reviewId }
        });
    }
    /**
     * Create workflow entry for review (idempotent)
     * Used when a review is first ingested.
     */
    async createIfNotExists(reviewId) {
        const existing = await this.getByReviewId(reviewId);
        if (existing)
            return existing;
        return database_1.prisma.reviewWorkflow.create({
            data: {
                reviewId,
                currentState: ReviewWorkflowState.PENDING,
                reminderCount: 0,
                lastActionAt: new Date(),
                lastReminderAt: null,
                nextReminderAt: null
            }
        });
    }
    /**
     * Internal state transition guard
     */
    assertValidTransition(from, to) {
        const allowed = {
            [ReviewWorkflowState.PENDING]: [
                ReviewWorkflowState.AUTO_REPLIED,
                ReviewWorkflowState.MANUAL_PENDING,
                ReviewWorkflowState.COMPLETED
            ],
            [ReviewWorkflowState.MANUAL_PENDING]: [
                ReviewWorkflowState.COMPLETED,
                ReviewWorkflowState.ESCALATED
            ],
            [ReviewWorkflowState.AUTO_REPLIED]: [
                ReviewWorkflowState.COMPLETED
            ],
            [ReviewWorkflowState.ESCALATED]: [
                ReviewWorkflowState.COMPLETED
            ],
            [ReviewWorkflowState.COMPLETED]: [
                ReviewWorkflowState.MANUAL_PENDING // Re-open if needed
            ]
        };
        if (!allowed[from] || !allowed[from].includes(to)) {
            throw new Error(`Illegal workflow transition from ${from} to ${to}`);
        }
    }
    /**
     * Generic state update with validation and audit timestamps
     */
    async updateState(reviewId, nextState, tx) {
        const client = tx || database_1.prisma;
        const current = await client.reviewWorkflow.findUnique({
            where: { reviewId }
        });
        if (!current) {
            throw new Error(`Workflow not found for reviewId=${reviewId}`);
        }
        this.assertValidTransition(current.currentState, nextState);
        return client.reviewWorkflow.update({
            where: { reviewId },
            data: {
                currentState: nextState,
                lastActionAt: new Date()
            }
        });
    }
    /**
     * Mark review as requiring manual processing
     */
    async moveToManualQueue(reviewId, firstReminderAt, tx) {
        const client = tx || database_1.prisma;
        return client.reviewWorkflow.update({
            where: { reviewId },
            data: {
                currentState: ReviewWorkflowState.MANUAL_PENDING,
                lastActionAt: new Date(),
                nextReminderAt: firstReminderAt,
                reminderCount: 0
            }
        });
    }
    /**
     * Mark auto replied path complete
     */
    async markAutoReplied(reviewId) {
        await this.updateState(reviewId, ReviewWorkflowState.AUTO_REPLIED);
        return this.complete(reviewId);
    }
    /**
     * Mark fully completed (manual or auto)
     */
    async complete(reviewId) {
        return this.updateState(reviewId, ReviewWorkflowState.COMPLETED);
    }
    /**
     * Reminder increment + scheduling
     */
    async incrementReminder(reviewId, nextReminderAt) {
        return database_1.prisma.reviewWorkflow.update({
            where: { reviewId },
            data: {
                reminderCount: {
                    increment: 1
                },
                lastReminderAt: new Date(),
                nextReminderAt
            }
        });
    }
    /**
     * Get all items needing reminder notifications
     * Conditions:
     * - in MANUAL_PENDING
     * - nextReminderAt expired
     * - reminderCount < 5
     */
    async getPendingReminders() {
        return database_1.prisma.reviewWorkflow.findMany({
            where: {
                currentState: ReviewWorkflowState.MANUAL_PENDING,
                nextReminderAt: {
                    lte: new Date()
                },
                reminderCount: {
                    lt: 5
                }
            }
        });
    }
    /**
     * Escalate items after max reminders
     */
    async escalateIfMaxRemindersReached(reviewId) {
        const wf = await this.getByReviewId(reviewId);
        if (!wf)
            throw new Error('Workflow not found');
        if (wf.reminderCount >= 5) {
            return this.updateState(reviewId, ReviewWorkflowState.ESCALATED);
        }
        return wf;
    }
    /**
     * Reset/remediate when manual reply is posted
     */
    async resolveManually(reviewId) {
        return database_1.prisma.reviewWorkflow.update({
            where: { reviewId },
            data: {
                currentState: ReviewWorkflowState.COMPLETED,
                lastActionAt: new Date(),
                nextReminderAt: null,
                lastReminderAt: null
            }
        });
    }
}
exports.ReviewWorkflowRepository = ReviewWorkflowRepository;
exports.reviewWorkflowRepository = new ReviewWorkflowRepository();
//# sourceMappingURL=review-workflow.repo.js.map