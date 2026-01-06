import type { Request, Response } from "express";
import bcryptjs from "bcryptjs";
import { z } from "zod";

import { usersRepository } from "../repository/users.repo";
import { auditRepository } from "../repository/audit.repo";
import { twoFAService, type TwoFASecret } from "../services/twofa.service";
import { encryptionService } from "../services/encryption.service";
import { logger } from "../utils/logger";
import { UserRole } from "@prisma/client";

//
// ---------- PASSWORD POLICY UTILITY (no controller cross-dependency)
//
function validatePasswordStrength(password: string) {
  const errors: string[] = [];

  if (password.length < 8) errors.push("Minimum 8 characters");
  if (!/[A-Z]/.test(password)) errors.push("Must include uppercase letter");
  if (!/[a-z]/.test(password)) errors.push("Must include lowercase letter");
  if (!/[0-9]/.test(password)) errors.push("Must include number");
  if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password))
    errors.push("Must include special symbol");

  return { valid: errors.length === 0, errors };
}

//
// ----------------- VALIDATION SCHEMAS -----------------
//

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole)
});

const UpdateProfileSchema = z.object({
  phone: z.string().optional(),
  googleEmail: z.string().email().optional(),
  gmbAccountId: z.string().optional()
});

export class UsersController {
  //
  // -------- GET ALL USERS ----------
  //
  async getAll(req: Request, res: Response) {
    try {
      const users = await usersRepository.getAllUsers();
      res.json(users);
    } catch (err) {
      logger.error("getAll failed", err);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  }

  //
  // -------- CREATE USER ----------
  //
  async create(req: Request, res: Response) {
    try {
      const actorId = (req as any).userId;
      const actor = await usersRepository.getUserById(actorId);

      const parsed = CreateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(parsed.error.flatten());
      }

      const { name, email, password, role } = parsed.data;

      // RBAC: only super admin can create super admin
      if (role === "SUPER_ADMIN" && actor?.role !== "SUPER_ADMIN") {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      const strength = validatePasswordStrength(password);
      if (!strength.valid) {
        return res
          .status(400)
          .json({ error: "Weak password", details: strength.errors });
      }

      const exists = await usersRepository.getUserByEmail(email);
      if (exists && !exists.deletedAt) {
        return res.status(409).json({ error: "User already exists" });
      }

      const passwordHash = await bcryptjs.hash(password, 12);

      const user = await usersRepository.createUser({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role
      });

      await auditRepository.createAuditLog({
        action: "USER_CREATED",
        entity: "User",
        entityId: user.id,
        userId: actorId,
        details: { name, email, role }
      });

      res.status(201).json({
        message: "User created",
        user
      });
    } catch (err) {
      logger.error("create user failed", err);
      res.status(500).json({ error: "Failed to create user" });
    }
  }

  //
  // -------- CHANGE PASSWORD ----------
  //
  async changePassword(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { currentPassword, newPassword } = req.body;

      const strength = validatePasswordStrength(newPassword);
      if (!strength.valid) {
        return res
          .status(400)
          .json({ error: "Weak password", details: strength.errors });
      }

      const user = await usersRepository.getUserById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const ok = await bcryptjs.compare(currentPassword, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Invalid current password" });

      const hash = await bcryptjs.hash(newPassword, 12);

      await usersRepository.updateUser(userId, {
        passwordHash: hash
      });

      await auditRepository.createAuditLog({
        action: "PASSWORD_CHANGED",
        entity: "User",
        entityId: userId,
        userId
      });

      res.json({ message: "Password changed" });
    } catch (err) {
      logger.error("changePassword failed", err);
      res.status(500).json({ error: "Failed to change password" });
    }
  }

  //
  // -------- DELETE USER ----------
  //
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const actorId = (req as any).userId;

      if (id === actorId)
        return res.status(400).json({ error: "Cannot delete self" });

      const user = await usersRepository.getUserById(id);
      if (!user) return res.status(404).json({ error: "User not found" });

      // prevent deleting last super admin
      if (user.role === "SUPER_ADMIN") {
        const remaining = await usersRepository.countSuperAdmins();
        if (remaining <= 1) {
          return res
            .status(400)
            .json({ error: "Cannot delete last SUPER_ADMIN" });
        }
      }

      await usersRepository.softDeleteUser(id);

      await auditRepository.createAuditLog({
        action: "USER_DELETED",
        entity: "User",
        entityId: id,
        userId: actorId
      });

      res.json({ message: "User deleted" });
    } catch (err) {
      logger.error("delete failed", err);
      res.status(500).json({ error: "Delete failed" });
    }
  }
}

export const usersController = new UsersController();
