"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManualReviewQueueRepository = void 0;
const client_1 = require("@prisma/client");
const base_repo_1 = require("./base.repo");
class ManualReviewQueueRepository extends base_repo_1.BaseRepository {
    constructor(prisma) {
        super(prisma);
    }
    async addToQueue(reviewId, outletId, assignedAdminId) {
        const firstReminderAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
        return this.prisma.manualReviewQueue.create({
            data: {
                reviewId,
                outletId,
                assignedAdminId,
                reminderCount: 0,
                nextReminderAt: firstReminderAt,
                status: client_1.ManualQueueStatus.PENDING,
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
        });
    }
    async getPendingReminders() {
        const now = new Date();
        return this.prisma.manualReviewQueue.findMany({
            where: {
                status: client_1.ManualQueueStatus.PENDING,
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
        });
    }
    async updateReminderSent(queueId) {
        const queueItem = await this.prisma.manualReviewQueue.findUnique({
            where: { id: queueId },
        });
        if (!queueItem) {
            throw new Error("Queue item not found");
        }
        const newCount = queueItem.reminderCount + 1;
        // Reminder intervals: 15min, 2h, 6h, 12h, 24h
        const reminderIntervals = [
            15 * 60 * 1000, // 15 minutes
            2 * 60 * 60 * 1000, // 2 hours
            6 * 60 * 60 * 1000, // 6 hours
            12 * 60 * 60 * 1000, // 12 hours
            24 * 60 * 60 * 1000, // 24 hours
        ];
        // After 5 reminders, escalate
        if (newCount >= 5) {
            return this.prisma.manualReviewQueue.update({
                where: { id: queueId },
                data: {
                    reminderCount: newCount,
                    status: client_1.ManualQueueStatus.ESCALATED,
                    nextReminderAt: null,
                },
            });
        }
        const nextInterval = reminderIntervals[newCount] || reminderIntervals[reminderIntervals.length - 1];
        const nextReminderAt = new Date(Date.now() + nextInterval);
        return this.prisma.manualReviewQueue.update({
            where: { id: queueId },
            data: {
                reminderCount: newCount,
                nextReminderAt,
            },
        });
    }
    async markAsResponded(queueId) {
        return this.prisma.manualReviewQueue.update({
            where: { id: queueId },
            data: {
                status: client_1.ManualQueueStatus.RESPONDED,
                nextReminderAt: null,
            },
        });
    }
    async getEscalatedReviews() {
        return this.prisma.manualReviewQueue.findMany({
            where: {
                status: client_1.ManualQueueStatus.ESCALATED,
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
        });
    }
    async deleteByOutlet(outletId) {
        return this.prisma.manualReviewQueue.deleteMany({
            where: { outletId }
        });
    }
}
exports.ManualReviewQueueRepository = ManualReviewQueueRepository;
//# sourceMappingURL=manual-review-queue.repo.js.map