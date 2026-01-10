"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewsRepository = exports.ReviewsRepository = void 0;
const database_1 = require("../database");
const client_1 = require("@prisma/client");
class ReviewsRepository {
    //
    // -------- BASIC CRUD ----------
    //
    async getAll() {
        return database_1.prisma.review.findMany({
            orderBy: { createdAt: "desc" }
        });
    }
    async getById(id) {
        return database_1.prisma.review.findUnique({
            where: { id },
            include: { outlet: true }
        });
    }
    async getByOutlet(outletId, limit = 50, offset = 0) {
        return database_1.prisma.review.findMany({
            where: { outletId },
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset
        });
    }
    //
    // -------- CREATION WITH RATING RULE ENGINE ----------
    //
    async createReview(data) {
        return database_1.prisma.$transaction(async (tx) => {
            // create base review
            const review = await tx.review.create({
                data: {
                    outletId: data.outletId,
                    rating: data.rating,
                    customerName: data.customerName,
                    reviewText: data.reviewText,
                    googleReviewId: data.googleReviewId,
                    status: data.rating >= 4
                        ? client_1.ReviewStatus.PENDING // awaiting AI auto-reply worker
                        : client_1.ReviewStatus.MANUAL_PENDING // will enter manual queue
                }
            });
            // ratings 1–3 → add to manual review queue
            if (data.rating <= 3) {
                await tx.manualReviewQueue.create({
                    data: {
                        reviewId: review.id,
                        outletId: data.outletId,
                        status: client_1.ManualQueueStatus.PENDING
                    }
                });
            }
            return review;
        });
    }
    //
    // -------- STATUS CHANGE HELPERS ----------
    //
    async markAsAutoReplied(reviewId, aiReplyText) {
        return database_1.prisma.review.update({
            where: { id: reviewId },
            data: {
                status: client_1.ReviewStatus.AUTO_REPLIED,
                aiReplyText,
                updatedAt: new Date()
            }
        });
    }
    async markAsClosed(reviewId) {
        return database_1.prisma.review.update({
            where: { id: reviewId },
            data: {
                status: client_1.ReviewStatus.CLOSED,
                updatedAt: new Date()
            }
        });
    }
    async saveManualReply(reviewId, reply) {
        return database_1.prisma.$transaction(async (tx) => {
            await tx.review.update({
                where: { id: reviewId },
                data: {
                    status: client_1.ReviewStatus.CLOSED,
                    manualReplyText: reply
                }
            });
            await tx.manualReviewQueue.update({
                where: { reviewId },
                data: {
                    status: client_1.ManualQueueStatus.RESPONDED
                }
            });
        });
    }
    //
    // -------- QUEUE QUERIES ----------
    //
    async getManualQueueItems() {
        return database_1.prisma.manualReviewQueue.findMany({
            where: { status: client_1.ManualQueueStatus.PENDING },
            include: {
                review: true,
                outlet: true,
                assignedAdmin: true
            },
            orderBy: { createdAt: "asc" }
        });
    }
    //
    // -------- ANALYTICS ----------
    //
    async getAnalytics(outletId, days = 30) {
        const from = new Date();
        from.setDate(from.getDate() - days);
        const reviews = await database_1.prisma.review.findMany({
            where: { outletId, createdAt: { gte: from } }
        });
        const total = reviews.length;
        const avgRating = total === 0
            ? 0
            : reviews.reduce((s, r) => s + r.rating, 0) / total;
        return {
            total,
            avgRating: Number(avgRating.toFixed(2)),
            closed: reviews.filter(r => r.status === "CLOSED").length,
            autoReplied: reviews.filter(r => r.status === "AUTO_REPLIED").length,
            manualPending: reviews.filter(r => r.status === "MANUAL_PENDING").length,
            ratingDistribution: {
                five: reviews.filter(r => r.rating === 5).length,
                four: reviews.filter(r => r.rating === 4).length,
                three: reviews.filter(r => r.rating === 3).length,
                two: reviews.filter(r => r.rating === 2).length,
                one: reviews.filter(r => r.rating === 1).length
            },
            periodDays: days
        };
    }
    //
    // -------- HARD DELETE ----------
    //
    async delete(id) {
        return database_1.prisma.review.delete({ where: { id } });
    }
    // Aliases for compatibility
    async getAllReviews() {
        return this.getAll();
    }
    async getReviewById(id) {
        return this.getById(id);
    }
    async getReviewsByOutlet(outletId, limit = 50, offset = 0) {
        return this.getByOutlet(outletId, limit, offset);
    }
    async updateReviewStatus(id, status) {
        // Assuming we have a method to update status, but let's see
        // For now, if status is CLOSED, call markAsClosed
        if (status === client_1.ReviewStatus.CLOSED) {
            return this.markAsClosed(id);
        }
        // Otherwise, perhaps update the review status
        return database_1.prisma.review.update({
            where: { id },
            data: { status }
        });
    }
    async getReviewAnalytics(outletId, days = 30) {
        return this.getAnalytics(outletId, days);
    }
    async deleteReview(id) {
        return this.delete(id);
    }
    async getOutletByReviewId(reviewId) {
        const review = await this.getById(reviewId);
        return review?.outlet || null;
    }
}
exports.ReviewsRepository = ReviewsRepository;
exports.reviewsRepository = new ReviewsRepository();
//# sourceMappingURL=reviews.repo.js.map