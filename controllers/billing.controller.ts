import { Request, Response } from "express";
import { billingRepository } from "../repository/billing.repo";
import { logger } from "../utils/logger";
import { auditRepository } from "../repository/audit.repo";
import { SubscriptionStatus } from "@prisma/client";

export class BillingController {
  async getByOutlet(req: Request, res: Response): Promise<void> {
    try {
      const { outletId } = req.params;

      const billing = await billingRepository.getBillingByOutletId(outletId);

      if (!billing) {
        res.status(404).json({ error: "Billing not found" });
        return;
      }

      res.status(200).json(billing);
    } catch (error) {
      logger.error("Failed to fetch billing", error);
      res.status(500).json({ error: "Failed to fetch billing" });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { outletId, status, trialEndsAt } = req.body;

      const actorId = (req as any).userId || null

      const billing = await billingRepository.createBilling({
        outletId,
        status,
        trialEndsAt,
      });

      res.status(201).json({
        message: "Billing created",
        billing,
      });

      if (billing) {
        await auditRepository.createAuditLog({
          action: 'BILLING_CREATED',
          entity: 'Billing',
          entityId: billing.id,
          userId: actorId,
        })
      }
    } catch (error) {
      logger.error("Failed to create billing", error);
      res.status(500).json({ error: "Failed to create billing" });
    }
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { outletId } = req.params;
      const { status } = req.body as { status: SubscriptionStatus };

      const actorId = (req as any).userId || null

      const billing = await billingRepository.updateSubscriptionStatus(outletId, status);

      res.status(200).json({
        message: "Billing status updated",
        billing,
      });

      if (billing) {
        await auditRepository.createAuditLog({
          action: 'BILLING_STATUS_UPDATED',
          entity: 'Billing',
          entityId: billing.id,
          userId: actorId,
          details: { status }
        })
      }
    } catch (error) {
      logger.error("Failed to update billing status", error);
      res.status(500).json({ error: "Failed to update billing status" });
    }
  }

  async stats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await billingRepository.getBillingStats();
      res.status(200).json(stats);
    } catch (error) {
      logger.error("Failed to fetch billing stats", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  }

  async getExpiringTrials(req: Request, res: Response): Promise<void> {
    try {
      const trials = await billingRepository.getExpiringTrials();
      res.status(200).json(trials);
    }
    catch (error) {
      logger.error("Failed to fetch expiring trials", error);
      res.status(500).json({ error: "Failed to fetch expiring trials" });
    }
  }

  async getOverdue(req: Request, res: Response): Promise<void> {
    try {
      const overdue = await billingRepository.getOverdueBillings();
      res.status(200).json(overdue);
    } catch (error) {
      logger.error("Failed to fetch overdue", error);
      res.status(500).json({ error: "Failed to fetch overdue" });
    }
  }
}

export const billingController = new BillingController();
