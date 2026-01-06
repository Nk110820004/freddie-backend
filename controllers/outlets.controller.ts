import { Request, Response } from "express";
import { OutletRepository } from "../repository/outlet.repo";
import { billingRepository } from "../repository/billing.repo";
import { auditRepository } from "../repository/audit.repo";
import { ManualReviewQueueRepository } from "../repository/manual-review-queue.repo";
import { prisma } from "../database";
import { logger } from "../utils/logger";
import {
  ApiStatus,
  OnboardingStatus,
  SubscriptionStatus,
  UserRole
} from "@prisma/client";

const outletRepo = new OutletRepository(prisma);
const manualQueueRepo = new ManualReviewQueueRepository(prisma);

export class OutletsController {
  //
  // -------- ADMIN — CREATE OUTLET (ONBOARDING START) --------
  //
  async create(req: Request, res: Response) {
    try {
      const actor = (req as any).user;

      if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") {
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
      res.status(500).json({ error: "Failed to create outlet" });
    }
  }

  //
  // -------- MARK ONBOARDING COMPLETE --------
  //
  async completeOnboarding(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const actor = (req as any).user;

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

      if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") {
        return res.status(403).json({ error: "Admin access required" });
      }

      if (!Object.values(SubscriptionStatus).includes(status)) {
        return res.status(400).json({ error: "Invalid subscription status" });
      }

      const billing = await billingRepository.updateStatus(id, status);

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

      if (enable) {
        if (
          outlet.onboardingStatus !== OnboardingStatus.COMPLETED ||
          outlet.billing?.status !== SubscriptionStatus.ACTIVE
        ) {
          return res.status(400).json({
            error:
              "API can be enabled only when onboarding completed and subscription ACTIVE"
          });
        }
      }

      const updated = await prisma.outlet.update({
        where: { id },
        data: { apiStatus: enable ? ApiStatus.ENABLED : ApiStatus.DISABLED }
      });

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
      res.status(500).json({ error: "Failed to update API status" });
    }
  }

  //
  // -------- SAFE DELETE OUTLET --------
  //
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const actor = (req as any).user;

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
}

export const outletsController = new OutletsController();
