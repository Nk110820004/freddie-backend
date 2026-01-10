"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardController = exports.DashboardController = void 0;
const database_1 = require("../database");
const logger_1 = require("../utils/logger");
const audit_repo_1 = require("../repository/audit.repo");
class DashboardController {
    /**
     * Returns all high-level dashboard metrics
     */
    async getMetrics(_req, res) {
        try {
            // parallel queries improve speed
            const [adminCount, activeOutlets, escalatedReviews, aiReplies, avgRating, apiKeyOutlets] = await Promise.all([
                database_1.prisma.user.count({
                    where: { deletedAt: null },
                }),
                database_1.prisma.outlet.count({
                    where: { status: "ACTIVE" },
                }),
                database_1.prisma.review.count({
                    where: { status: "ESCALATED" },
                }),
                database_1.prisma.review.count({
                    where: { status: "CLOSED" },
                }),
                database_1.prisma.review.aggregate({
                    _avg: { rating: true },
                }),
                database_1.prisma.apiKey.count({
                    where: { isActive: true },
                }),
            ]);
            res.json({
                admin_count: adminCount,
                active_outlets: activeOutlets,
                escalated_reviews: escalatedReviews,
                ai_replied_count: aiReplies,
                avg_rating: avgRating._avg.rating ?? 0,
                outlets_with_api_keys: apiKeyOutlets,
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch dashboard metrics", error);
            res.status(500).json({
                error: "Failed to fetch dashboard metrics",
            });
        }
    }
    async getRecentActivities(req, res) {
        try {
            const logs = await audit_repo_1.auditRepository.getRecentAuditLogs(10);
            const activities = logs.map((log) => ({
                id: log.id,
                action: log.action.replace(/_/g, " "),
                entity: log.entity,
                user: log.user?.name || "System",
                timestamp: log.createdAt,
                details: log.details,
            }));
            res.status(200).json(activities);
        }
        catch (error) {
            logger_1.logger.error("Failed to get recent activities", error);
            res.status(500).json({ error: "Failed to retrieve activities" });
        }
    }
}
exports.DashboardController = DashboardController;
exports.dashboardController = new DashboardController();
//# sourceMappingURL=dashboard.controller.js.map