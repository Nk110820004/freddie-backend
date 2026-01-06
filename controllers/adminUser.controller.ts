import type { Request, Response } from "express";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import crypto from "crypto";

import { usersRepository } from "../repository/users.repo";
import { auditRepository } from "../repository/audit.repo";
import { emailService } from "../services/email.service";
import { logger } from "../utils/logger";

import { UserRole } from "@prisma/client";

const AdminCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]),
  phoneNumber: z.string().optional(),
  googleEmail: z.string().email().optional()
});

function requireSuperAdmin(req: Request) {
  const actor = (req as any).user;
  if (!actor || actor.role !== "SUPER_ADMIN") {
    const err: any = new Error("SUPER_ADMIN role required");
    err.status = 403;
    throw err;
  }
  return actor;
}

export class AdminUserController {
  async create(req: Request, res: Response) {
    try {
      const actor = requireSuperAdmin(req);
      const input = AdminCreateSchema.parse(req.body);

      // Only super admin can create super admin
      if (input.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
        return res.status(403).json({ error: "Only SUPER_ADMIN may create SUPER_ADMIN" });
      }

      const existing = await usersRepository.getUserByEmail(input.email.toLowerCase());
      if (existing) return res.status(409).json({ error: "User already exists" });

      // cryptographically strong temporary password
      const tempPassword = crypto.randomBytes(12).toString("base64url");
      const passwordHash = await bcryptjs.hash(tempPassword, 12);

      const user = await usersRepository.createUser({
        name: input.name,
        email: input.email.toLowerCase(),
        role: input.role as UserRole,
        passwordHash,
        whatsappNumber: input.phoneNumber,
        googleEmail: input.googleEmail
      });

      await auditRepository.createAuditLog({
        action: "ADMIN_USER_CREATED",
        entity: "User",
        entityId: user.id,
        userId: actor.id,
        details: { role: input.role }
      });

      await emailService.sendOnboardingEmail(
        input.email,
        input.name,
        tempPassword
      ).catch(() => logger.warn("Failed to send onboarding email"));

      res.status(201).json({
        message: "Admin user created",
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    } catch (err: any) {
      logger.error("Admin user create failed", err);
      res.status(err.status || 500).json({ error: err.message || "Failed" });
    }
  }
}

export const adminUserController = new AdminUserController();
