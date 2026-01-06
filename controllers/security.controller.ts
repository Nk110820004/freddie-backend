import { Request, Response } from "express";

import { ipAllowlistRepository } from "../repository/ip-allowlist.repo";
import { apiKeyRepository } from "../repository/api-key.repo";
import { OutletRepository } from "../repository/outlet.repo";
import { auditRepository } from "../repository/audit.repo";
import { apiKeyService } from "../services/apikey.service";
import { logger } from "../utils/logger";
import { prisma } from "../database";

import {
  OnboardingStatus,
  SubscriptionStatus,
  ApiStatus,
  UserRole
} from "@prisma/client";

const outletRepo = new OutletRepository(prisma);

export class SecurityController {
  //
  // -------------------- RBAC ENFORCER --------------------
  //
  private ensureAdmin(req: Request) {
    const actor = (req as any).user;
    if (!actor || (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN")) {
      const err: any = new Error("Admin access required");
      err.status = 403;
      throw err;
    }
    return actor;
  }

  //
  // -------------------- IP ALLOWLIST --------------------
  //
  async addIP(req: Request, res: Response) {
    try {
      const actor = this.ensureAdmin(req);
      const { ip, description } = req.body;

      if (!ip) return res.status(400).json({ error: "IP required" });

      // strict IPv4 + CIDR only
      const cidrRegex =
        /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)(\/([0-9]|[12]\d|3[0-2]))?$/;

      if (!cidrRegex.test(ip)) {
        return res.status(400).json({ error: "Invalid IPv4/CIDR format" });
      }

      const exists = await ipAllowlistRepository.getByIP(ip);
      if (exists) return res.status(409).json({ error: "IP already whitelisted" });

      const entry = await ipAllowlistRepository.create(ip, description);

      await auditRepository.createAuditLog({
        action: "IP_ALLOWLIST_ADDED",
        entity: "IpAllowlist",
        entityId: entry.id,
        userId: actor.id
      });

      res.status(201).json({ message: "Added", entry });
    } catch (err: any) {
      logger.error("addIP failed", err);
      res.status(err.status || 500).json({ error: err.message || "Failed" });
    }
  }

  //
  // -------------------- API KEY CREATION --------------------
  //
  async createAPIKey(req: Request, res: Response) {
    try {
      const actor = this.ensureAdmin(req);
      const { outletId } = req.body;

      const outlet = await outletRepo.getOutletById(outletId);

      if (!outlet) return res.status(404).json({ error: "Outlet not found" });

      // ENFORCE ALL BUSINESS RULES

      if (outlet.onboardingStatus !== OnboardingStatus.COMPLETED) {
        return res.status(400).json({
          error: "Onboarding must be completed before API key can be issued"
        });
      }

      if (outlet.billing?.status !== SubscriptionStatus.ACTIVE) {
        return res.status(400).json({
          error: "Active subscription required before API key can be issued"
        });
      }

      if (outlet.apiStatus !== ApiStatus.ENABLED) {
        return res.status(400).json({
          error: "API must be enabled before API key can be issued"
        });
      }

      const { key, keyHash, expiresAt } = apiKeyService.generateKey();

      const apiKey = await apiKeyRepository.create({
        outletId,
        userId: actor.id,
        keyHash,
        expiresAt
      });

      await auditRepository.createAuditLog({
        action: "API_KEY_CREATED",
        entity: "ApiKey",
        entityId: apiKey.id,
        userId: actor.id,
        details: { outletId }
      });

      res.status(201).json({
        message: "API key generated",
        key,
        expiresAt,
        note: "This key will never be shown again"
      });
    } catch (err: any) {
      logger.error("createAPIKey failed", err);
      res.status(err.status || 500).json({ error: err.message || "Failed" });
    }
  }

  //
  // revoke / rotate behave the same as yours but admin-guarded
  //
}

export const securityController = new SecurityController();
