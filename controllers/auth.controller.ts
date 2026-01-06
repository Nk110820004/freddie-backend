import type { Request, Response } from "express";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { usersRepository } from "../repository/users.repo";
import { outletRepository } from "../repository/outlet.repo";
import { refreshTokensRepository } from "../repository/refreshTokens.repo";
import { auditRepository } from "../repository/audit.repo";

import { twoFAService } from "../services/twofa.service";
import { encryptionService } from "../services/encryption.service";
import { logger } from "../utils/logger";

import {
  generateRandomToken,
  hashToken,
  signAccessToken
} from "../utils/token.util";

import { SubscriptionStatus } from "@prisma/client";

const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  outletName: z.string().min(1)
});

export class AuthController {
  private readonly JWT_SECRET =
    process.env.JWT_ACCESS_SECRET ||
    "development-secret-change-this-in-production";

  private readonly JWT_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "24h";
  private readonly TEMP_TOKEN_EXPIRY = process.env.TEMP_TOKEN_EXPIRY || "10m";
  private readonly REFRESH_EXPIRES =
    process.env.JWT_REFRESH_EXPIRY || "7d";

  //
  // ---------------- REGISTER USER + OUTLET ----------------
  //
  async register(req: Request, res: Response) {
    try {
      const parsed = RegisterSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid input",
          errors: parsed.error.flatten()
        });
      }

      const { name, email, password, outletName } = parsed.data;

      const existing = await usersRepository.getUserByEmail(
        email.toLowerCase()
      );

      if (existing) {
        return res.status(409).json({ error: "User already exists" });
      }

      const passwordHash = await bcryptjs.hash(password, 12);

      const user = await usersRepository.createUser({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: "USER"
      });

      // create outlet in PENDING onboarding & TRIAL subscription
      const outlet = await outletRepository.createOutlet({
        name: outletName,
        userId: user.id,
        primaryContactName: name,
        contactEmail: email.toLowerCase(),
        contactPhone: "N/A",
        category: "OTHER",
        subscriptionPlan: "MONTHLY"
      });

      await auditRepository.createAuditLog({
        action: "USER_REGISTER",
        entity: "User",
        entityId: user.id,
        userId: user.id
      });

      const token = signAccessToken({
        userId: user.id,
        role: user.role,
        email: user.email
      });

      res.cookie("auth_token", token, this.authCookieOptions());

      res.status(201).json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        outlet,
        message: "Registration successful – onboarding pending"
      });
    } catch (err) {
      logger.error("register failed", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  //
  // ---------------- ADMIN LOGIN ----------------
  //
  async loginAdmin(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const user = await usersRepository.getUserByEmail(
        email.toLowerCase()
      );

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const ok = await bcryptjs.compare(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // requires 2FA -> issue temp token
      if (user.twoFactorEnabled && user.twoFactorVerified) {
        const tempToken = jwt.sign(
          {
            u: user.id,
            requiresTwoFA: true
          },
          this.JWT_SECRET,
          { expiresIn: this.TEMP_TOKEN_EXPIRY }
        );

        return res.status(200).json({
          requiresTwoFA: true,
          tempToken
        });
      }

      await this.issueFullSession(user, req, res);
    } catch (err) {
      logger.error("loginAdmin failed", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  //
  // ---------------- USER LOGIN ----------------
  //
  async loginUser(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const user = await usersRepository.getUserByEmail(
        email.toLowerCase()
      );

      if (!user || user.role !== "USER") {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const ok = await bcryptjs.compare(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      await this.issueFullSession(user, req, res);
    } catch (err) {
      logger.error("loginUser failed", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  //
  // ---------------- 2FA VERIFY ----------------
  //
  async verifyTwoFA(req: Request, res: Response) {
    try {
      const { token, tempToken } = req.body;

      const payload = jwt.verify(
        tempToken,
        this.JWT_SECRET
      ) as any;

      const user = await usersRepository.getUserById(payload.u);

      if (!user || !user.twoFactorSecret) {
        return res.status(400).json({
          error: "2FA not configured"
        });
      }

      const secret = encryptionService.decryptFromJson(
        user.twoFactorSecret
      );

      const ok = twoFAService.verifyToken(secret, token);

      if (!ok.valid) {
        return res.status(401).json({
          error: "Invalid 2FA code"
        });
      }

      await this.issueFullSession(user, req, res);
    } catch (err) {
      logger.error("verifyTwoFA failed", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  //
  // ---------------- LOGOUT ----------------
  //
  async logout(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;

      await refreshTokensRepository.deleteByUserId(userId);

      res.clearCookie("auth_token");
      res.clearCookie("refresh_token");

      res.json({ message: "Logged out" });
    } catch (err) {
      logger.error("logout failed", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  //
  // ---------------- INTERNAL HELPERS ----------------
  //

  private async issueFullSession(user: any, req: Request, res: Response) {
    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role,
      email: user.email
    });

    const refreshPlain = generateRandomToken(32);
    const refreshHash = hashToken(refreshPlain);

    const expiresAt = new Date(
      Date.now() + this.parseExpiryToMs(this.REFRESH_EXPIRES)
    );

    await refreshTokensRepository.create(refreshHash, user.id, expiresAt);

    await auditRepository.createAuditLog({
      action: "USER_LOGIN",
      entity: "User",
      entityId: user.id,
      userId: user.id,
      ip: req.ip
    });

    res.cookie("auth_token", accessToken, this.authCookieOptions());
    res.cookie("refresh_token", refreshPlain, this.refreshCookieOptions());

    res.json({
      token: accessToken,
      refreshToken: "ok",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  }

  private authCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: this.parseExpiryToMs(this.JWT_EXPIRY)
    };
  }

  private refreshCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: this.parseExpiryToMs(this.REFRESH_EXPIRES)
    };
  }

  private parseExpiryToMs(v: string) {
    if (v.endsWith("d")) return parseInt(v) * 86400000;
    if (v.endsWith("h")) return parseInt(v) * 3600000;
    return parseInt(v) * 1000;
  }
}

export const authController = new AuthController();
