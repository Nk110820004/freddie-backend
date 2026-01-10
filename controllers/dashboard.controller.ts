import type { Request, Response } from "express"
import { prisma } from "../database"
import { logger } from "../utils/logger"
import { auditRepository } from "../repository/audit.repo"

export class DashboardController {
  /**
   * Returns all high-level dashboard metrics
   */
  async getMetrics(_req: Request, res: Response): Promise<void> {
    try {
      // parallel queries improve speed
      const [adminCount, activeOutlets, escalatedReviews, aiReplies, avgRating, apiKeyOutlets] = await Promise.all([
        prisma.user.count({
          where: { deletedAt: null },
        }),

        prisma.outlet.count({
          where: { status: "ACTIVE" },
        }),

        prisma.review.count({
          where: { status: "ESCALATED" },
        }),

        prisma.review.count({
          where: { status: "CLOSED" },
        }),

        prisma.review.aggregate({
          _avg: { rating: true },
        }),

        prisma.apiKey.count({
          where: { isActive: true },
        }),
      ])

      res.json({
        admin_count: adminCount,
        active_outlets: activeOutlets,
        escalated_reviews: escalatedReviews,
        ai_replied_count: aiReplies,
        avg_rating: avgRating._avg.rating ?? 0,
        outlets_with_api_keys: apiKeyOutlets,
      })
    } catch (error) {
      logger.error("Failed to fetch dashboard metrics", error)
      res.status(500).json({
        error: "Failed to fetch dashboard metrics",
      })
    }
  }

  async getRecentActivities(req: Request, res: Response): Promise<void> {
    try {
      const logs = await auditRepository.getRecentAuditLogs(10)

      const activities = logs.map((log: any) => ({
        id: log.id,
        action: log.action.replace(/_/g, " "),
        entity: log.entity,
        user: log.user?.name || "System",
        timestamp: log.createdAt,
        details: log.details,
      }))

      res.status(200).json(activities)
    } catch (error) {
      logger.error("Failed to get recent activities", error)
      res.status(500).json({ error: "Failed to retrieve activities" })
    }
  }
}

export const dashboardController = new DashboardController()
