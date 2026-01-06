import type { Request, Response } from "express"
import { reviewsRepository } from "../repository/reviews.repo"
import { getOutletByReviewId } from "../repository/reviews.repo"
import { usersRepository } from "../repository/users.repo"
import { gmbService } from "../integrations/gmb"
import { auditRepository } from "../repository/audit.repo"
import { logger } from "../utils/logger"
import { prisma } from "../prisma"
import { ManualReviewQueueRepository } from "../repository/manual-review-queue.repo"

export class ReviewsController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const reviews = await reviewsRepository.getAllReviews()
      res.status(200).json(reviews)
    } catch (error) {
      logger.error("Failed to fetch reviews", error)
      res.status(500).json({ error: "Failed to fetch reviews" })
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const review = await reviewsRepository.getReviewById(id)

      if (!review) {
        res.status(404).json({ error: "Review not found" })
        return
      }

      res.status(200).json(review)
    } catch (error) {
      logger.error("Failed to fetch review", error)
      res.status(500).json({ error: "Failed to fetch review" })
    }
  }

  async getByOutlet(req: Request, res: Response): Promise<void> {
    try {
      const { outletId } = req.params
      const { limit = "50", offset = "0" } = req.query

      const reviews = await reviewsRepository.getReviewsByOutlet(
        outletId,
        Number.parseInt(limit as string, 10),
        Number.parseInt(offset as string, 10),
      )

      res.status(200).json(reviews)
    } catch (error) {
      logger.error("Failed to fetch outlet reviews", error)
      res.status(500).json({ error: "Failed to fetch outlet reviews" })
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { outletId, rating, customerName, reviewText } = req.body

      if (!outletId || !rating || !reviewText) {
        res.status(400).json({
          error: "outletId, rating, and reviewText are required",
        })
        return
      }

      const review = await reviewsRepository.createReview({
        outletId,
        rating,
        customerName: customerName || "Anonymous",
        reviewText,
      })

      if (rating <= 3) {
        const manualQueueRepo = new ManualReviewQueueRepository(prisma)
        await manualQueueRepo.addToQueue(review.id, outletId)
      }

      res.status(201).json({
        message: "Review created successfully",
        review,
      })
    } catch (error) {
      logger.error("Failed to create review", error)
      res.status(500).json({ error: "Failed to create review" })
    }
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { status } = req.body

      const review = await reviewsRepository.updateReviewStatus(id, status)

      res.status(200).json({
        message: "Status updated",
        review,
      })
    } catch (error) {
      logger.error("Failed to update review status", error)
      res.status(500).json({ error: "Failed to update status" })
    }
  }

  async addAiReply(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { aiReply } = req.body
      // Not implemented: AI reply workflow is pending schema/implementation
      res.status(501).json({ error: "Not implemented: AI reply" })
    } catch (error) {
      logger.error("Failed to add AI reply", error)
      res.status(500).json({ error: "Failed to add AI reply" })
    }
  }

  async addManualReply(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { manualReply } = req.body
      const userId = (req as any).userId

      if (!manualReply || typeof manualReply !== "string" || manualReply.trim().length === 0) {
        res.status(400).json({ error: "Manual reply text is required" })
        return
      }

      const review = await reviewsRepository.getReviewById(id)
      if (!review) {
        res.status(404).json({ error: "Review not found" })
        return
      }

      // Check if user owns the outlet
      const outlet = await getOutletByReviewId(id)
      if (!outlet || outlet.userId !== userId) {
        res.status(403).json({ error: "Forbidden: You do not own this outlet" })
        return
      }

      // Update review
      await reviewsRepository.updateReview(id, {
        manualReplyText: manualReply,
        status: "CLOSED",
      } as any)

      // Remove from manual queue if present
      const queueItem = await prisma.manualReviewQueue.findFirst({
        where: { reviewId: id },
      })

      if (queueItem) {
        const manualQueueRepo = new ManualReviewQueueRepository(prisma)
        await manualQueueRepo.markAsResponded(queueItem.id)
      }

      // Post to GMB if credentials available
      const user = await usersRepository.getUserById(userId)
      if (user && user.googleRefreshToken && outlet.googleLocationName && review.googleReviewId) {
        await gmbService.postReply(
          outlet.googleLocationName,
          review.googleReviewId,
          manualReply,
          user.googleRefreshToken,
        )
      }

      // Audit log
      await auditRepository.createAuditLog({
        action: "MANUAL_REPLY_POSTED",
        entity: "Review",
        entityId: id,
        userId,
        details: `Manual reply posted (length=${manualReply.length})`,
      })

      res.status(200).json({
        message: "Manual reply posted successfully",
        review: {
          id,
          status: "CLOSED",
        },
      })
    } catch (error) {
      logger.error("Failed to add manual reply", error)
      res.status(500).json({ error: "Failed to add manual reply" })
    }
  }

  async analytics(req: Request, res: Response): Promise<void> {
    try {
      const { outletId } = req.params
      const { days = "30" } = req.query

      const data = await reviewsRepository.getReviewAnalytics(outletId, Number.parseInt(days as string, 10))

      res.status(200).json(data)
    } catch (error) {
      logger.error("Failed to get review analytics", error)
      res.status(500).json({ error: "Failed to get analytics" })
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      await reviewsRepository.deleteReview(id)

      res.status(200).json({
        message: "Review deleted successfully",
      })
    } catch (error) {
      logger.error("Failed to delete review", error)
      res.status(500).json({ error: "Failed to delete review" })
    }
  }
}

export const reviewsController = new ReviewsController()
