import type { Request, Response } from "express"
import bcryptjs from "bcryptjs"
import jwt from "jsonwebtoken"

import { usersRepository } from "../repository/users.repo"
import { auditRepository } from "../repository/audit.repo"
import { refreshTokensRepository } from "../repository/refreshTokens.repo"

import { twoFAService } from "../services/twofa.service"
import { encryptionService } from "../services/encryption.service"
import { logger } from "../utils/logger"
import { generateRandomToken, hashToken, signAccessToken } from "../utils/token.util"

export interface LoginRequest {
  email: string
  password: string
}

export interface TwoFAVerifyRequest {
  email: string
  token: string
  tempToken: string
}

export interface TempTokenPayload {
  email: string
  requiresTwoFA: boolean
  iat: number
  exp: number
}

export class AuthController {
  private readonly JWT_SECRET = process.env.JWT_ACCESS_SECRET || "your-secret-key-change-in-production"

  private readonly JWT_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "24h"
  private readonly TEMP_TOKEN_EXPIRY = process.env.TEMP_TOKEN_EXPIRY || "10m"

  private readonly REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRY || "7d"

  /**
   * LOGIN ADMIN
   * Separated admin login - only allows ADMIN and SUPER_ADMIN roles
   */
  async loginAdmin(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body as LoginRequest

      const user = await usersRepository.getUserByEmail(email.toLowerCase())

      if (!user) {
        await this.logSecurityEvent("LOGIN_FAILED_INVALID_CREDENTIALS", req, null)
        res.status(401).json({ error: "Invalid email or password" })
        return
      }

      // Only admins can login via admin route
      if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        await this.logSecurityEvent("LOGIN_FAILED_INSUFFICIENT_ROLE", req, user.id)
        res.status(403).json({ error: "Admin access required" })
        return
      }

      if (user.deletedAt) {
        await this.logSecurityEvent("LOGIN_FAILED_DELETED_USER", req, user.id)
        res.status(403).json({ error: "Account disabled" })
        return
      }

      const ok = await bcryptjs.compare(password, user.passwordHash)

      if (!ok) {
        await this.logSecurityEvent("LOGIN_FAILED_INVALID_CREDENTIALS", req, user.id)
        res.status(401).json({ error: "Invalid email or password" })
        return
      }

      await usersRepository.updateLastLogin(user.id, this.getClientIp(req))

      // If 2FA enabled -> issue temp token
      if (user.twoFactorEnabled && user.twoFactorVerified) {
        const tempToken = (jwt as any).sign(
          {
            email: user.email,
            requiresTwoFA: true,
          },
          this.JWT_SECRET as any,
          { expiresIn: this.TEMP_TOKEN_EXPIRY } as any,
        )

        res.status(200).json({
          requiresTwoFA: true,
          tempToken,
          message: "Please provide 2FA code",
        })

        return
      }

      const token = signAccessToken({ userId: user.id, role: user.role, email: user.email })

      // create refresh token (rotating)
      const refreshTokenPlain = generateRandomToken(32)
      const refreshHash = hashToken(refreshTokenPlain)
      const expiresAt = new Date(Date.now() + this.parseExpiryToMs(this.REFRESH_EXPIRES))
      await refreshTokensRepository.create(refreshHash, user.id, expiresAt)

      await this.logSecurityEvent("USER_LOGIN", req, user.id)

      res.cookie("auth_token", token, this.authCookieOptions())
      res.cookie("refresh_token", refreshTokenPlain, this.refreshCookieOptions())

      res.status(200).json({ token, refreshToken: "ok", user: { id: user.id, name: user.name, email: user.email, role: user.role, twoFactorEnabled: user.twoFactorEnabled } })
    } catch (err) {
      logger.error("Admin login error", err)
      res.status(500).json({ error: "Internal server error" })
    }
  }

  /**
   * LOGIN USER
   * Separated user login - only allows USER role
   */
  async loginUser(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body as LoginRequest

      const user = await usersRepository.getUserByEmail(email.toLowerCase())

      if (!user) {
        await this.logSecurityEvent("LOGIN_FAILED_INVALID_CREDENTIALS", req, null)
        res.status(401).json({ error: "Invalid email or password" })
        return
      }

      // Only users can login via user route
      if (user.role !== "USER") {
        await this.logSecurityEvent("LOGIN_FAILED_INSUFFICIENT_ROLE", req, user.id)
        res.status(403).json({ error: "User access required" })
        return
      }

      if (user.deletedAt) {
        await this.logSecurityEvent("LOGIN_FAILED_DELETED_USER", req, user.id)
        res.status(403).json({ error: "Account disabled" })
        return
      }

      const ok = await bcryptjs.compare(password, user.passwordHash)

      if (!ok) {
        await this.logSecurityEvent("LOGIN_FAILED_INVALID_CREDENTIALS", req, user.id)
        res.status(401).json({ error: "Invalid email or password" })
        return
      }

      await usersRepository.updateLastLogin(user.id, this.getClientIp(req))


      const token = signAccessToken({ userId: user.id, role: user.role, email: user.email })

      const refreshTokenPlain = generateRandomToken(32)
      const refreshHash = hashToken(refreshTokenPlain)
      const expiresAt = new Date(Date.now() + this.parseExpiryToMs(this.REFRESH_EXPIRES))
      await refreshTokensRepository.create(refreshHash, user.id, expiresAt)

      await this.logSecurityEvent("USER_LOGIN", req, user.id)

      res.cookie("auth_token", token, this.authCookieOptions())
      res.cookie("refresh_token", refreshTokenPlain, this.refreshCookieOptions())

      res.status(200).json({ token, refreshToken: "ok", user: { id: user.id, name: user.name, email: user.email, role: user.role } })
    } catch (err) {
      logger.error("User login error", err)
      res.status(500).json({ error: "Internal server error" })
    }
  }

  /**
   * GET CURRENT USER
   * New endpoint to return current user info from token
   */
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" })
        return
      }

      const user = await usersRepository.getUserById(userId)

      if (!user) {
        res.status(404).json({ error: "User not found" })
        return
      }

      res.status(200).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          whatsappNumber: user.whatsappNumber,
          gmbAccountId: user.gmbAccountId,
        },
      })
    } catch (err) {
      logger.error("Get current user error", err)
      res.status(500).json({ error: "Internal server error" })
    }
  }

  /**
   * VERIFY 2FA
   */
  async verifyTwoFA(req: Request, res: Response): Promise<void> {
    try {
      const { email, token, tempToken } = req.body as TwoFAVerifyRequest

      let tempPayload: TempTokenPayload

      try {
        tempPayload = jwt.verify(tempToken, this.JWT_SECRET) as TempTokenPayload
      } catch {
        res.status(401).json({ error: "Invalid or expired temporary token" })
        return
      }

      const user = await usersRepository.getUserByEmail(email.toLowerCase())

      if (!user || !user.twoFactorSecret) {
        res.status(400).json({ error: "2FA not configured for this account" })
        return
      }

      const decryptedSecret = encryptionService.decryptFromJson(user.twoFactorSecret)

      const isValid = twoFAService.verifyToken(decryptedSecret, token)

      if (!isValid.valid) {
        await this.logSecurityEvent("2FA_VERIFICATION_FAILED", req, user.id)

        res.status(401).json({ error: "Invalid 2FA code" })
        return
      }

      const jwtToken = signAccessToken({ userId: user.id, role: user.role, email: user.email })

      const refreshTokenPlain = generateRandomToken(32)
      const refreshHash = hashToken(refreshTokenPlain)
      const expiresAt = new Date(Date.now() + this.parseExpiryToMs(this.REFRESH_EXPIRES))
      await refreshTokensRepository.create(refreshHash, user.id, expiresAt)

      await this.logSecurityEvent("2FA_VERIFICATION_SUCCESS", req, user.id)

      res.cookie("auth_token", jwtToken, this.authCookieOptions())
      res.cookie("refresh_token", refreshTokenPlain, this.refreshCookieOptions())

      res.status(200).json({ token: jwtToken, refreshToken: "ok", user: { id: user.id, name: user.name, email: user.email, role: user.role, twoFactorEnabled: user.twoFactorEnabled } })
    } catch (err) {
      logger.error("2FA verify error", err)
      res.status(500).json({ error: "Internal server error" })
    }
  }

  /**
   * LOGOUT
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" })
        return
      }

      await this.logSecurityEvent("USER_LOGOUT", req, userId)

      // Revoke refresh tokens for user
      await refreshTokensRepository.deleteByUserId(userId)

      res.clearCookie("auth_token")
      res.clearCookie("refresh_token")

      res.status(200).json({ message: "Logged out successfully" })
    } catch (err) {
      logger.error("Logout error", err)
      res.status(500).json({ error: "Internal server error" })
    }
  }

  /**
   * STATIC PASSWORD VALIDATION
   */
  static validatePasswordStrength(password: string) {
    const errors: string[] = []

    if (password.length < 12) errors.push("Password must be at least 12 characters long")
    if (!/[A-Z]/.test(password)) errors.push("Password must contain at least one uppercase letter")
    if (!/[a-z]/.test(password)) errors.push("Password must contain at least one lowercase letter")
    if (!/\d/.test(password)) errors.push("Password must contain at least one number")
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password))
      errors.push("Password must contain at least one special character")

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * JWT GENERATION
   */
  private generateJWT(user: { id: string; role: string; email: string }): string {
    return signAccessToken({ userId: user.id, role: user.role, email: user.email })
  }

  private authCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: (process.env.COOKIE_SAME_SITE as any) || "lax",
      maxAge: this.parseExpiryToMs(this.JWT_EXPIRY),
    }
  }

  private refreshCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: (process.env.COOKIE_SAME_SITE as any) || "lax",
      maxAge: this.parseExpiryToMs(this.REFRESH_EXPIRES),
    }
  }

  private parseExpiryToMs(expiry: string): number {
    // supports formats like '7d', '24h', '3600' (seconds)
    if (/^\d+d$/.test(expiry)) {
      const days = parseInt(expiry.replace('d', ''), 10)
      return days * 24 * 60 * 60 * 1000
    }
    if (/^\d+h$/.test(expiry)) {
      const hours = parseInt(expiry.replace('h', ''), 10)
      return hours * 60 * 60 * 1000
    }
    if (/^\d+$/.test(expiry)) {
      const seconds = parseInt(expiry, 10)
      return seconds * 1000
    }
    // default 1 day
    return 24 * 60 * 60 * 1000
  }

  /**
   * HELPERS
   */
  private getClientIp(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"]
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim()
    }
    return req.socket.remoteAddress || "unknown"
  }

  /**
   * AUDIT LOG
   */
  private async logSecurityEvent(action: string, req: Request, userId: string | null) {
    if (!userId) return

    try {
      await auditRepository.createAuditLog({
        action,
        entity: "Auth",
        entityId: userId,
        userId,
        ip: this.getClientIp(req),
        userAgent: req.headers["user-agent"] ?? "unknown",
      })
    } catch (err) {
      logger.error("Failed to log audit security event", err)
    }
  }
}

export const authController = new AuthController()
