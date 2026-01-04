import { db } from '../database';

// ReviewWorkflow model is optional; provide runtime-safe stubs to avoid build-time errors
export class ReviewWorkflowRepository {
  async getByReviewId(reviewId: string): Promise<any | null> {
    return (db as any).reviewWorkflow?.findUnique ? (db as any).reviewWorkflow.findUnique({ where: { reviewId } }) : null
  }

  async create(reviewId: string): Promise<any> {
    return (db as any).reviewWorkflow?.create ? (db as any).reviewWorkflow.create({ data: { reviewId, currentState: 'PENDING' } }) : null
  }

  async updateState(reviewId: string, state: any): Promise<any> {
    return (db as any).reviewWorkflow?.update ? (db as any).reviewWorkflow.update({ where: { reviewId }, data: { currentState: state, lastActionAt: new Date() } }) : null
  }

  async incrementReminder(reviewId: string, nextReminderAt: Date): Promise<any> {
    return (db as any).reviewWorkflow?.update ? (db as any).reviewWorkflow.update({ where: { reviewId }, data: { reminderCount: { increment: 1 }, lastReminderAt: new Date(), nextReminderAt } }) : null
  }

  async getPendingReminders(): Promise<any[]> {
    return (db as any).reviewWorkflow?.findMany ? (db as any).reviewWorkflow.findMany({ where: { currentState: 'ESCALATED_TO_WHATSAPP', nextReminderAt: { lte: new Date() }, reminderCount: { lt: 5 } } }) : []
  }

  async complete(reviewId: string): Promise<any> {
    return (db as any).reviewWorkflow?.update ? (db as any).reviewWorkflow.update({ where: { reviewId }, data: { currentState: 'COMPLETED' } }) : null
  }
}

export const reviewWorkflowRepository = new ReviewWorkflowRepository();
