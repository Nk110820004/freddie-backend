import { prisma } from '../database';

export enum ReviewWorkflowState {
  PENDING = 'PENDING',
  AUTO_REPLIED = 'AUTO_REPLIED',
  MANUAL_PENDING = 'MANUAL_PENDING',
  COMPLETED = 'COMPLETED',
  ESCALATED = 'ESCALATED'
}

export class ReviewWorkflowRepository {
  /**
   * Fetch by reviewId
   */
  async getByReviewId(reviewId: string) {
    return prisma.reviewWorkflow.findUnique({
      where: { reviewId }
    });
  }

  /**
   * Create workflow entry for review (idempotent)
   * Used when a review is first ingested.
   */
  async createIfNotExists(reviewId: string) {
    const existing = await this.getByReviewId(reviewId);
    if (existing) return existing;

    return prisma.reviewWorkflow.create({
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
  private assertValidTransition(from: ReviewWorkflowState, to: ReviewWorkflowState) {
    const allowed: Record<ReviewWorkflowState, ReviewWorkflowState[]> = {
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
  async updateState(reviewId: string, nextState: ReviewWorkflowState, tx?: any) {
    const client = tx || prisma;
    
    const current = await client.reviewWorkflow.findUnique({
      where: { reviewId }
    });

    if (!current) {
      throw new Error(`Workflow not found for reviewId=${reviewId}`);
    }

    this.assertValidTransition(current.currentState as ReviewWorkflowState, nextState);

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
  async moveToManualQueue(reviewId: string, firstReminderAt: Date, tx?: any) {
    const client = tx || prisma;
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
  async markAutoReplied(reviewId: string) {
    await this.updateState(reviewId, ReviewWorkflowState.AUTO_REPLIED);
    return this.complete(reviewId);
  }

  /**
   * Mark fully completed (manual or auto)
   */
  async complete(reviewId: string) {
    return this.updateState(reviewId, ReviewWorkflowState.COMPLETED);
  }

  /**
   * Reminder increment + scheduling
   */
  async incrementReminder(reviewId: string, nextReminderAt: Date) {
    return prisma.reviewWorkflow.update({
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
    return prisma.reviewWorkflow.findMany({
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
  async escalateIfMaxRemindersReached(reviewId: string) {
    const wf = await this.getByReviewId(reviewId);
    if (!wf) throw new Error('Workflow not found');

    if (wf.reminderCount >= 5) {
      return this.updateState(reviewId, ReviewWorkflowState.ESCALATED);
    }

    return wf;
  }

  /**
   * Reset/remediate when manual reply is posted
   */
  async resolveManually(reviewId: string) {
    return prisma.reviewWorkflow.update({
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

export const reviewWorkflowRepository = new ReviewWorkflowRepository();
