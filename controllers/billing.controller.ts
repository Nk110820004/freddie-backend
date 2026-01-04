import { Request, Response } from "express";
import { billingRepository } from "../repository/billing.repo";
import { logger } from "../utils/logger";
import { auditRepository } from "../repository/audit.repo";

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
      const { outletId, plan, trialEndsAt } = req.body;

      const actorId = (req as any).userId || null

      const billing = await billingRepository.createBilling({
        outletId,
        plan,
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

  async updatePlan(req: Request, res: Response): Promise<void> {
    try {
      const { outletId } = req.params;
      const { plan } = req.body;

      const actorId = (req as any).userId || null

      const billing = await billingRepository.updateBillingPlan(outletId, plan);

      res.status(200).json({
        message: "Plan updated",
        billing,
      });

      if (billing) {
        await auditRepository.createAuditLog({
          action: 'BILLING_PLAN_UPDATED',
          entity: 'Billing',
          entityId: billing.id,
          userId: actorId,
          details: { plan }
        })
      }
    } catch (error) {
      logger.error("Failed to update plan", error);
      res.status(500).json({ error: "Failed to update plan" });
    }
  }

  async deactivate(req: Request, res: Response): Promise<void> {
    try {
      const { outletId } = req.params;

      const actorId = (req as any).userId || null

      const billing = await billingRepository.deactivateBilling(outletId);

      res.status(200).json({
        message: "Billing deactivated",
        billing,
      });

      if (billing) {
        await auditRepository.createAuditLog({
          action: 'BILLING_DEACTIVATED',
          entity: 'Billing',
          entityId: billing.id,
          userId: actorId,
        })
      }
    } catch (error) {
      logger.error("Failed to deactivate billing", error);
      res.status(500).json({ error: "Failed to deactivate billing" });
    }
  }

  async activate(req: Request, res: Response): Promise<void> {
    try {
      const { outletId } = req.params;

      const actorId = (req as any).userId || null

      const billing = await billingRepository.activateBilling(outletId);

      res.status(200).json({
        message: "Billing activated",
        billing,
      });

      if (billing) {
        await auditRepository.createAuditLog({
          action: 'BILLING_ACTIVATED',
          entity: 'Billing',
          entityId: billing.id,
          userId: actorId,
        })
      }
    } catch (error) {
      logger.error("Failed to activate billing", error);
      res.status(500).json({ error: "Failed to activate billing" });
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
    } catch (error) {
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
