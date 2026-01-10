import { type PrismaClient, ManualQueueStatus } from "@prisma/client"
import { BaseRepository } from "./base.repo"

export class ManualReviewQueueRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma)
  }

  async addToQueue(reviewId: string, outletId: string, assignedAdminId?: string) {
    const firstReminderAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now

    return this.prisma.manualReviewQueue.create({
      data: {
        reviewId,
        outletId,
        assignedAdminId,
        reminderCount: 0,
        nextReminderAt: firstReminderAt,
        status: ManualQueueStatus.PENDING,
      },
      include: {
        review: {
          include: {
            outlet: {
              include: {
                user: {
                  select: {
                    whatsappNumber: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    })
  }

  async getPendingReminders() {
    const now = new Date()

    return this.prisma.manualReviewQueue.findMany({
      where: {
        status: ManualQueueStatus.PENDING,
        nextReminderAt: {
          lte: now,
        },
      },
      include: {
        review: {
          include: {
            outlet: {
              include: {
                user: {
                  select: {
                    whatsappNumber: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        assignedAdmin: {
          select: {
            whatsappNumber: true,
            name: true,
            email: true,
          },
        },
      },
    })
  }

  async updateReminderSent(queueId: string) {
    const queueItem = await this.prisma.manualReviewQueue.findUnique({
      where: { id: queueId },
    })

    if (!queueItem) {
      throw new Error("Queue item not found")
    }

    const newCount = queueItem.reminderCount + 1

    // Reminder intervals: 15min, 2h, 6h, 12h, 24h
    const reminderIntervals = [
      15 * 60 * 1000, // 15 minutes
      2 * 60 * 60 * 1000, // 2 hours
      6 * 60 * 60 * 1000, // 6 hours
      12 * 60 * 60 * 1000, // 12 hours
      24 * 60 * 60 * 1000, // 24 hours
    ]

    // After 5 reminders, escalate
    if (newCount >= 5) {
      return this.prisma.manualReviewQueue.update({
        where: { id: queueId },
        data: {
          reminderCount: newCount,
          status: ManualQueueStatus.ESCALATED,
          nextReminderAt: null,
        },
      })
    }

    const nextInterval = reminderIntervals[newCount] || reminderIntervals[reminderIntervals.length - 1]
    const nextReminderAt = new Date(Date.now() + nextInterval)

    return this.prisma.manualReviewQueue.update({
      where: { id: queueId },
      data: {
        reminderCount: newCount,
        nextReminderAt,
      },
    })
  }

  async markAsResponded(queueId: string) {
    return this.prisma.manualReviewQueue.update({
      where: { id: queueId },
      data: {
        status: ManualQueueStatus.RESPONDED,
        nextReminderAt: null,
      },
    })
  }

  async getEscalatedReviews() {
    return this.prisma.manualReviewQueue.findMany({
      where: {
        status: ManualQueueStatus.ESCALATED,
      },
      include: {
        review: {
          include: {
            outlet: true,
          },
        },
        assignedAdmin: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    })
  }

  async deleteByOutlet(outletId: string) {
    return this.prisma.manualReviewQueue.deleteMany({
      where: { outletId }
    })
  }
}
