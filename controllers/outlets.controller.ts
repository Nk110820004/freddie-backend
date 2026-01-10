import { Request, Response } from "express";
import { outletsRepository } from "../repository/outlets.repo";
import { billingRepository } from "../repository/billing.repo";
import { auditRepository } from "../repository/audit.repo";
import { ManualReviewQueueRepository } from "../repository/manual-review-queue.repo";
import { reviewsRepository } from "../repository/reviews.repo";
import { prisma } from "../database";
import { logger } from "../utils/logger";
import {
  ApiStatus,
  OnboardingStatus,
  SubscriptionStatus,
  UserRole
} from "@prisma/client";

const outletRepo = outletsRepository;
const manualQueueRepo = new ManualReviewQueueRepository(prisma);

export class OutletsController {
  //
  // -------- ADMIN — CREATE OUTLET (ONBOARDING START) --------
  //
  async create(req: Request, res: Response) {
    try {
      const actor = (req as any).user;

      if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const {
        name,
        userId,
        primaryContactName,
        contactEmail,
        contactPhone,
        category,
        subscriptionPlan
      } = req.body;

      if (
        !name ||
        !userId ||
        !primaryContactName ||
        !contactEmail ||
        !contactPhone
      ) {
        return res.status(400).json({
          error:
            "name, userId, primaryContactName, contactEmail, contactPhone are required"
        });
      }

      // Business Rule: Ensure user exists
      const userExists = await prisma.user.findUnique({ where: { id: userId } });
      if (!userExists) {
        return res.status(400).json({ error: "Specified user does not exist" });
      }

      const outlet = await outletRepo.createOutlet({
        name,
        userId,
        primaryContactName,
        contactEmail,
        contactPhone,
        category: category ?? "OTHER",
        subscriptionPlan: subscriptionPlan ?? "MONTHLY"
      });

      await auditRepository.createAuditLog({
        action: "OUTLET_ONBOARDING_STARTED",
        entity: "Outlet",
        entityId: outlet.id,
        userId: actor.id
      });

      res.status(201).json({
        message: "Outlet created in onboarding state",
        outlet
      });
    } catch (err) {
      logger.error("create outlet failed", err);
      res.status(500).json({ error: (err as any).message || "Failed to create outlet" });
    }
  }

  //
  // -------- MARK ONBOARDING COMPLETE --------
  //
  async completeOnboarding(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const actor = (req as any).user;

      // Business Rule: Admin or Owner? (Currently admin-only for strict flow)
      if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const outlet = await outletRepo.completeOnboarding(id);

      await auditRepository.createAuditLog({
        action: "OUTLET_ONBOARDING_COMPLETED",
        entity: "Outlet",
        entityId: id,
        userId: actor.id
      });

      res.json({
        message: "Onboarding completed",
        outlet
      });
    } catch (err) {
      logger.error("completeOnboarding failed", err);
      res.status(400).json({ error: (err as any).message });
    }
  }

  //
  // -------- MANUAL SUBSCRIPTION OVERRIDE (ADMIN PANEL) --------
  //
  async markSubscriptionStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, remark } = req.body;
      const actor = (req as any).user;

      if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: "Admin access required" });
      }

      if (!Object.values(SubscriptionStatus).includes(status)) {
        return res.status(400).json({ error: "Invalid subscription status" });
      }

      const billing = await billingRepository.updateSubscriptionStatus(id, status);

      await auditRepository.createAuditLog({
        action: "SUBSCRIPTION_STATUS_MANUAL_CHANGE",
        entity: "Billing",
        entityId: billing.id,
        userId: actor.id,
        details: { status, remark }
      });

      res.json({ message: "Subscription updated", billing });
    } catch (err) {
      logger.error("Subscription override failed", err);
      res.status(500).json({ error: "Failed to change subscription" });
    }
  }

  //
  // -------- ENABLE/DISABLE API (Automation gating) --------
  //
  async setApiStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { enable } = req.body;
      const actor = (req as any).user;

      const outlet = await outletRepo.getOutletById(id);

      if (!outlet) {
        return res.status(404).json({ error: "Outlet not found" });
      }

      // Check permissions
      if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN && actor.id !== outlet.userId) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const apiStatus = enable ? ApiStatus.ENABLED : ApiStatus.DISABLED;
      
      // Business rules are enforced inside the repository method
      const updated = await outletRepo.setApiStatus(id, apiStatus);

      await auditRepository.createAuditLog({
        action: "API_STATUS_CHANGED",
        entity: "Outlet",
        entityId: id,
        userId: actor.id,
        details: { apiStatus: updated.apiStatus }
      });

      res.json({ message: "Updated API status", outlet: updated });
    } catch (err) {
      logger.error("API status change failed", err);
      res.status(400).json({ error: (err as any).message });
    }
  }

  //
  // -------- SAFE DELETE OUTLET --------
  //
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const actor = (req as any).user;

      if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
        return res.status(403).json({ error: "Admin access required" });
      }

      await manualQueueRepo.deleteByOutlet(id);

      await prisma.outlet.delete({ where: { id } });

      await auditRepository.createAuditLog({
        action: "OUTLET_DELETED",
        entity: "Outlet",
        entityId: id,
        userId: actor.id
      });

      res.json({ message: "Outlet deleted" });
    } catch (err) {
      logger.error("delete outlet failed", err);
      res.status(500).json({ error: "Failed to delete outlet" });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const outlets = await outletsRepository.getAllOutlets();
      res.json(outlets);
    } catch (err) {
      logger.error("getAll outlets failed", err);
      res.status(500).json({ error: "Failed to get outlets" });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const outlet = await outletsRepository.getOutletById(id);
      if (!outlet) return res.status(404).json({ error: "Outlet not found" });
      res.json(outlet);
    } catch (err) {
      logger.error("getById outlet failed", err);
      res.status(500).json({ error: "Failed to get outlet" });
    }
  }

  async getHealth(req: Request, res: Response) {
    try {
      // Placeholder
      res.json({ status: "healthy" });
    } catch (err) {
      logger.error("getHealth failed", err);
      res.status(500).json({ error: "Failed" });
    }
  }

  async getReviews(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const reviews = await reviewsRepository.getReviewsByOutlet(id);
      res.json(reviews);
    } catch (err) {
      logger.error("getReviews failed", err);
      res.status(500).json({ error: "Failed to get reviews" });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;
      // Assume outletRepository has update
      const updated = await outletsRepository.update(id, data);
      res.json(updated);
    } catch (err) {
      logger.error("update outlet failed", err);
      res.status(500).json({ error: "Failed to update outlet" });
    }
  }
}

export const outletsController = new OutletsController();
