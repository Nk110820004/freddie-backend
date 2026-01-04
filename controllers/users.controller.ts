import type { Request, Response } from "express"
import bcryptjs from "bcryptjs"

import { usersRepository } from "../repository/users.repo"
import { auditRepository } from "../repository/audit.repo"

import { twoFAService, type TwoFASecret } from "../services/twofa.service"
import { encryptionService } from "../services/encryption.service"
import { authController, AuthController } from "./auth.controller"
import { logger } from "../utils/logger"

export interface CreateUserRequest {
  name: string
  email: string
  password: string
  role: "SUPER_ADMIN" | "ADMIN"
}

export interface UpdateUserRequest {
  name?: string
  role?: "SUPER_ADMIN" | "ADMIN"
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface UpdateProfileRequest {
  phone?: string
  googleEmail?: string
  gmbAccountId?: string
}

export class UsersController {
  /**
   * GET ALL USERS
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const users = await usersRepository.getAllUsers()
      res.status(200).json(users)
    } catch (error) {
      logger.error("Failed to get users", error)
      res.status(500).json({ error: "Failed to retrieve users" })
    }
  }

  /**
   * GET USER BY ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      const user = await usersRepository.getUserById(id)

      if (!user) {
        res.status(404).json({ error: "User not found" })
        return
      }

      res.status(200).json(user)
    } catch (error) {
      logger.error("Failed to get user", error)
      res.status(500).json({ error: "Failed to retrieve user" })
    }
  }

  /**
   * CREATE ADMIN USER
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password, role } = req.body as CreateUserRequest
      const actorId = (req as any).userId

      if (!name || !email || !password || !role) {
        res.status(400).json({ error: "Name, email, password, and role are required" })
        return
      }

      if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
        res.status(400).json({ error: "Invalid role" })
        return
      }

      const strength = AuthController.validatePasswordStrength(password)
      if (!strength.valid) {
        res.status(400).json({
          error: "Password does not meet requirements",
          details: strength.errors,
        })
        return
      }

      const existing = await usersRepository.getUserByEmail(email.toLowerCase())
      if (existing && !existing.deletedAt) {
        res.status(409).json({ error: "User already exists" })
        return
      }

      const passwordHash = await bcryptjs.hash(password, 12)

      const user = await usersRepository.createUser({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
      })

      await auditRepository.createAuditLog({
        action: "USER_CREATED",
        entity: "User",
        entityId: user.id,
        userId: actorId,
        details: { name, email, role },
      })

      res.status(201).json({
        message: "User created successfully",
        user,
        nextStep: "User must enroll 2FA",
      })
    } catch (error) {
      logger.error("Failed to create user", error)
      res.status(500).json({ error: "Failed to create user" })
    }
  }

  /**
   * UPDATE USER
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { name, role } = req.body as UpdateUserRequest
      const actorId = (req as any).userId

      const current = await usersRepository.getUserById(id)

      if (!current) {
        res.status(404).json({ error: "User not found" })
        return
      }

      if (role && !["SUPER_ADMIN", "ADMIN"].includes(role)) {
        res.status(400).json({ error: "Invalid role" })
        return
      }

      const updated = await usersRepository.updateUser(id, {
        ...(name && { name }),
        ...(role && { role }),
      })

      await auditRepository.createAuditLog({
        action: "USER_UPDATED",
        entity: "User",
        entityId: id,
        userId: actorId,
        details: { name: name ?? current.name, role: role ?? current.role },
      })

      res.status(200).json({
        message: "User updated successfully",
        user: updated,
      })
    } catch (error) {
      logger.error("Failed to update user", error)
      res.status(500).json({ error: "Failed to update user" })
    }
  }

  /**
   * SOFT DELETE USER
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const actorId = (req as any).userId

      if (id === actorId) {
        res.status(400).json({ error: "Cannot delete own account" })
        return
      }

      const user = await usersRepository.getUserById(id)

      if (!user) {
        res.status(404).json({ error: "User not found" })
        return
      }

      await usersRepository.softDeleteUser(id)

      await auditRepository.createAuditLog({
        action: "USER_DELETED",
        entity: "User",
        entityId: id,
        userId: actorId,
        details: { email: user.email },
      })

      res.status(200).json({ message: "User deleted successfully" })
    } catch (error) {
      logger.error("Failed to delete user", error)
      res.status(500).json({ error: "Failed to delete user" })
    }
  }

  /**
   * ENROLL IN 2FA
   */
  async enrollTwoFA(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params

      const user = await usersRepository.getUserById(id)

      if (!user) {
        res.status(404).json({ error: "User not found" })
        return
      }

      const secret: TwoFASecret = await twoFAService.generateSecret(user.email)

      res.status(200).json({
        message: "Scan QR code in authenticator app",
        secret: secret.secret,
        qrCode: secret.qrCode,
        backupCodes: secret.backupCodes,
      })
    } catch (error) {
      logger.error("Failed to enroll 2FA", error)
      res.status(500).json({ error: "Failed to enroll 2FA" })
    }
  }

  /**
   * VERIFY 2FA ENROLLMENT
   */
  async verifyTwoFAEnrollment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { secret, token } = req.body
      const actorId = (req as any).userId

      if (!secret || !token) {
        res.status(400).json({ error: "Missing secret or token" })
        return
      }

      const isValid = twoFAService.verifyToken(secret, token)
      if (!isValid.valid) {
        res.status(400).json({ error: "Invalid verification code" })
        return
      }

      const encrypted = encryptionService.encryptToJson(secret)

      const user = await usersRepository.updateUser(id, {
        twoFactorSecret: encrypted as any,
        twoFactorEnabled: true,
        twoFactorVerified: true,
      })

      await auditRepository.createAuditLog({
        action: "2FA_ENABLED",
        entity: "User",
        entityId: id,
        userId: actorId,
      })

      res.status(200).json({
        message: "2FA enabled successfully",
        user,
      })
    } catch (error) {
      logger.error("Failed to verify 2FA enrollment", error)
      res.status(500).json({ error: "Failed to verify 2FA enrollment" })
    }
  }

  /**
   * CHANGE PASSWORD
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId
      const { currentPassword, newPassword } = req.body as ChangePasswordRequest

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "Both passwords required" })
        return
      }

      const strength = AuthController.validatePasswordStrength(newPassword)
      if (!strength.valid) {
        res.status(400).json({ error: "Weak password", details: strength.errors })
        return
      }

      const user = await usersRepository.getUserById(userId)

      if (!user) {
        res.status(404).json({ error: "User not found" })
        return
      }

      const matches = await bcryptjs.compare(currentPassword, user.passwordHash)

      if (!matches) {
        res.status(401).json({ error: "Current password incorrect" })
        return
      }

      const hash = await bcryptjs.hash(newPassword, 12)

      await usersRepository.updateUser(userId, { passwordHash: hash as any })

      await auditRepository.createAuditLog({
        action: "PASSWORD_CHANGED",
        entity: "User",
        entityId: userId,
        userId,
      })

      res.status(200).json({ message: "Password changed" })
    } catch (error) {
      logger.error("Failed to change password", error)
      res.status(500).json({ error: "Failed to change password" })
    }
  }

  /**
   * GET CURRENT USER PROFILE
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId

      const user = await usersRepository.getUserById(userId)

      if (!user) {
        res.status(404).json({ error: "User not found" })
        return
      }

      const { passwordHash, ...profile } = user
      res.status(200).json(profile)
    } catch (error) {
      logger.error("Failed to get profile", error)
      res.status(500).json({ error: "Failed to retrieve profile" })
    }
  }

  /**
   * UPDATE USER PROFILE (onboarding fields)
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId
      const { phone, googleEmail, gmbAccountId } = req.body as UpdateProfileRequest

      const user = await usersRepository.getUserById(userId)

      if (!user) {
        res.status(404).json({ error: "User not found" })
        return
      }

      const updated = await usersRepository.updateUser(userId, {
        ...(phone && { phoneNumber: phone }),
        ...(googleEmail && { googleEmail }),
        ...(gmbAccountId && { gmbAccountId }),
      })

      await auditRepository.createAuditLog({
        action: "PROFILE_UPDATED",
        entity: "User",
        entityId: userId,
        userId,
        details: { phone, googleEmail, gmbAccountId },
      })

      const { passwordHash, ...profile } = updated
      res.status(200).json({
        message: "Profile updated successfully",
        user: profile,
      })
    } catch (error) {
      logger.error("Failed to update profile", error)
      res.status(500).json({ error: "Failed to update profile" })
    }
  }
}

export const usersController = new UsersController()
