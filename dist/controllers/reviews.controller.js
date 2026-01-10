"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewsController = exports.ReviewsController = void 0;
const reviews_repo_1 = require("../repository/reviews.repo");
const users_repo_1 = require("../repository/users.repo");
const gmb_1 = require("../integrations/gmb");
const audit_repo_1 = require("../repository/audit.repo");
const logger_1 = require("../utils/logger");
const database_1 = require("../database");
const manual_review_queue_repo_1 = require("../repository/manual-review-queue.repo");
class ReviewsController {
    async getAll(req, res) {
        try {
            const reviews = await reviews_repo_1.reviewsRepository.getAllReviews();
            res.status(200).json(reviews);
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch reviews", error);
            res.status(500).json({ error: "Failed to fetch reviews" });
        }
    }
    async getById(req, res) {
        try {
            const { id } = req.params;
            const review = await reviews_repo_1.reviewsRepository.getReviewById(id);
            if (!review) {
                res.status(404).json({ error: "Review not found" });
                return;
            }
            res.status(200).json(review);
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch review", error);
            res.status(500).json({ error: "Failed to fetch review" });
        }
    }
    async getByOutlet(req, res) {
        try {
            const { outletId } = req.params;
            const { limit = "50", offset = "0" } = req.query;
            const reviews = await reviews_repo_1.reviewsRepository.getReviewsByOutlet(outletId, Number.parseInt(limit, 10), Number.parseInt(offset, 10));
            res.status(200).json(reviews);
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch outlet reviews", error);
            res.status(500).json({ error: "Failed to fetch outlet reviews" });
        }
    }
    async create(req, res) {
        try {
            const { outletId, rating, customerName, reviewText } = req.body;
            if (!outletId || !rating || !reviewText) {
                res.status(400).json({
                    error: "outletId, rating, and reviewText are required",
                });
                return;
            }
            const review = await reviews_repo_1.reviewsRepository.createReview({
                outletId,
                rating,
                customerName: customerName || "Anonymous",
                reviewText,
            });
            if (rating <= 3) {
                const manualQueueRepo = new manual_review_queue_repo_1.ManualReviewQueueRepository(database_1.prisma);
                await manualQueueRepo.addToQueue(review.id, outletId);
            }
            res.status(201).json({
                message: "Review created successfully",
                review,
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to create review", error);
            res.status(500).json({ error: "Failed to create review" });
        }
    }
    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const review = await reviews_repo_1.reviewsRepository.updateReviewStatus(id, status);
            res.status(200).json({
                message: "Status updated",
                review,
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to update review status", error);
            res.status(500).json({ error: "Failed to update status" });
        }
    }
    async addAiReply(req, res) {
        try {
            const { id } = req.params;
            const { aiReply } = req.body;
            // Not implemented: AI reply workflow is pending schema/implementation
            res.status(501).json({ error: "Not implemented: AI reply" });
        }
        catch (error) {
            logger_1.logger.error("Failed to add AI reply", error);
            res.status(500).json({ error: "Failed to add AI reply" });
        }
    }
    async addManualReply(req, res) {
        try {
            const { id } = req.params;
            const { manualReply } = req.body;
            const userId = req.userId;
            if (!manualReply || typeof manualReply !== "string" || manualReply.trim().length === 0) {
                res.status(400).json({ error: "Manual reply text is required" });
                return;
            }
            const review = await reviews_repo_1.reviewsRepository.getReviewById(id);
            if (!review) {
                res.status(404).json({ error: "Review not found" });
                return;
            }
            // Check if user owns the outlet
            const outlet = await reviews_repo_1.reviewsRepository.getOutletByReviewId(id);
            if (!outlet || outlet.userId !== userId) {
                res.status(403).json({ error: "Forbidden: You do not own this outlet" });
                return;
            }
            // Update review
            await database_1.prisma.review.update({
                where: { id },
                data: {
                    manualReplyText: manualReply,
                    status: "CLOSED",
                }
            });
            // Remove from manual queue if present
            const queueItem = await database_1.prisma.manualReviewQueue.findFirst({
                where: { reviewId: id },
            });
            if (queueItem) {
                const manualQueueRepo = new manual_review_queue_repo_1.ManualReviewQueueRepository(database_1.prisma);
                await manualQueueRepo.markAsResponded(queueItem.id);
            }
            // Post to GMB if credentials available
            const user = await users_repo_1.usersRepository.getUserById(userId);
            if (user && user.googleRefreshToken && outlet.googleLocationName && review.googleReviewId) {
                await gmb_1.gmbService.postReply(outlet.googleLocationName, review.googleReviewId, manualReply, user.googleRefreshToken);
            }
            // Audit log
            await audit_repo_1.auditRepository.createAuditLog({
                action: "MANUAL_REPLY_POSTED",
                entity: "Review",
                entityId: id,
                userId,
                details: `Manual reply posted (length=${manualReply.length})`,
            });
            res.status(200).json({
                message: "Manual reply posted successfully",
                review: {
                    id,
                    status: "CLOSED",
                },
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to add manual reply", error);
            res.status(500).json({ error: "Failed to add manual reply" });
        }
    }
    async analytics(req, res) {
        try {
            const { outletId } = req.params;
            const { days = "30" } = req.query;
            const data = await reviews_repo_1.reviewsRepository.getReviewAnalytics(outletId, Number.parseInt(days, 10));
            res.status(200).json(data);
        }
        catch (error) {
            logger_1.logger.error("Failed to get review analytics", error);
            res.status(500).json({ error: "Failed to get analytics" });
        }
    }
    async delete(req, res) {
        try {
            const { id } = req.params;
            await reviews_repo_1.reviewsRepository.deleteReview(id);
            res.status(200).json({
                message: "Review deleted successfully",
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to delete review", error);
            res.status(500).json({ error: "Failed to delete review" });
        }
    }
}
exports.ReviewsController = ReviewsController;
exports.reviewsController = new ReviewsController();
//# sourceMappingURL=reviews.controller.js.map