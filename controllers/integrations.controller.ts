import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import { whatsappService } from "../integrations/whatsapp";
import { gmbService } from "../integrations/gmb";
import { openaiService } from "../integrations/openai";
import { googleConnectTokenRepository } from "../repository/google-connect-token.repo";
import { googleIntegrationRepository } from "../repository/google-integration.repo";
import { logger } from "../utils/logger";

export class IntegrationsController {
  /**
   * ============================================================
   * GOOGLE OAUTH
   * ============================================================
   */

  /**
   * Get Google OAuth URL
   * - If `token` is present => outlet-specific connect flow (state)
   * - Else => legacy system flow
   */
  async getGoogleAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.query;

      let authUrl: string;

      if (token && typeof token === "string") {
        authUrl = gmbService.getAuthUrlWithState(token);
      } else {
        authUrl = gmbService.getAuthUrl();
      }

      res.status(200).json({ authUrl });
    } catch (error) {
      logger.error("Failed to get Google auth URL", error);
      res.status(500).json({ error: "Failed to get auth URL" });
    }
  }

  /**
   * Handle Google OAuth callback
   *
   * If `state` exists:
   * - treat as outlet connect flow
   * - validate connect token
   * - save refresh token for outlet
   * - return locations list for selection
   *
   * If `state` not present:
   * - legacy system-level flow
   * - DO NOT return refresh token (security)
   */
  async handleGoogleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query;

      if (!code || typeof code !== "string") {
        res.status(400).json({ error: "Authorization code is required" });
        return;
      }

      const refreshToken = await gmbService.exchangeCode(code);

      if (!refreshToken) {
        res.status(400).json({ error: "Failed to exchange authorization code" });
        return;
      }

      // ------------------------------------------
      // Outlet-specific connection (recommended flow)
      // ------------------------------------------
      if (state && typeof state === "string") {
        const connectToken = await googleConnectTokenRepository.findByToken(state);

        if (!connectToken) {
          res.status(400).json({ error: "Invalid or expired connect token" });
          return;
        }

        if (connectToken.usedAt) {
          res.status(400).json({ error: "Connect token has already been used" });
          return;
        }

        if (connectToken.expiresAt < new Date()) {
          res.status(400).json({ error: "Connect token has expired" });
          return;
        }

        /**
         * NOTE:
         * Google email is optional; you can later fetch via People API if needed.
         * Keeping placeholder is fine for now.
         */
        const googleEmail = "pending@google.com";

        // If outletId is present, create integration
        if (connectToken.outletId) {
          // Create / update integration record
          await googleIntegrationRepository.create({
            outletId: connectToken.outletId,
            googleEmail,
            refreshToken,
          });
        } else if (connectToken.userId) {
          // If it's a user-level connect (Step 2 of wizard)
          const { usersRepository } = await import(
            "../repository/users.repo.js"
          );
          await usersRepository.updateUser(connectToken.userId, {
            googleRefreshToken: refreshToken,
            googleEmail,
          });
        }

        // Mark token as used
        await googleConnectTokenRepository.markAsUsed(state);

        // Fetch locations so outlet can select which GBP location to link
        const locations = await gmbService.listLocations(refreshToken);

        logger.info("Google OAuth callback processed for outlet", {
          outletId: connectToken.outletId ?? null,
        });

        res.status(200).json({
          message: "Google Business Profile connected successfully to outlet",
          outletId: connectToken.outletId ?? null,
          locations: locations || [],
        });

        return;
      }

      // ------------------------------------------
      // Legacy system-level flow (no state)
      // ------------------------------------------
      logger.warn("Google OAuth callback processed WITHOUT state (legacy flow).");

      // ✅ SECURITY: do not return refresh token publicly
      res.status(200).json({
        message: "Google Business Profile connected successfully",
      });
    } catch (error) {
      logger.error("Failed to handle Google callback", error);
      res.status(500).json({ error: "Failed to connect Google account" });
    }
  }

  /**
   * Fetch GMB locations (legacy/global)
   */
  async getGMBLocations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const locations = await gmbService.listLocations();

      if (!locations) {
        res.status(400).json({ error: "Failed to fetch locations" });
        return;
      }

      res.status(200).json({ locations });
    } catch (error) {
      logger.error("Failed to fetch GMB locations", error);
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  }

  /**
   * Fetch GMB locations for a specific outlet (uses outlet refresh token)
   */
  async getGMBLocationsForOutlet(req: Request, res: Response): Promise<void> {
    try {
      const { outletId } = req.params;

      if (!outletId) {
        res.status(400).json({ error: "Outlet ID is required" });
        return;
      }

      const integration = await googleIntegrationRepository.findByOutletId(outletId);

      if (!integration) {
        res.status(400).json({ error: "No Google integration found for this outlet" });
        return;
      }

      const locations = await gmbService.listLocations(integration.refreshToken);

      if (!locations) {
        res.status(400).json({ error: "Failed to fetch locations" });
        return;
      }

      res.status(200).json({ locations });
    } catch (error) {
      logger.error("Failed to fetch GMB locations for outlet", error);
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  }

  /**
   * ============================================================
   * WHATSAPP WEBHOOK
   * ============================================================
   */

  /**
   * WhatsApp webhook handler (verification + incoming messages)
   */
  async handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
    try {
      const hub = req.query.hub as any;

      // Verification handshake
      if (hub && hub.mode === "subscribe" && hub.verify_token) {
        const isValid = whatsappService.verifyWebhook(hub.verify_token as string);

        if (isValid) {
          res.status(200).send(hub.challenge);
          logger.info("WhatsApp webhook verified");
          return;
        }

        res.status(403).json({ error: "Invalid verify token" });
        return;
      }

      // Incoming message event
      const message = req.body;

      logger.info("Received WhatsApp webhook", {
        from: message?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from,
      });

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error("Failed to handle WhatsApp webhook", error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  }

  /**
   * ============================================================
   * WHATSAPP TEST (TEMPLATE ONLY)
   * ============================================================
   */

  /**
   * Test WhatsApp template message sending
   * Template-only policy enforced.
   */
  async sendTestMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        res.status(400).json({ error: "phoneNumber is required" });
        return;
      }

      /**
       * ✅ This template must exist in WhatsApp Manager:
       * freddie_manual_review_reminder_v1 (en_US)
       */
      const result = await whatsappService.sendTemplate(
        phoneNumber,
        "freddie_manual_review_reminder_v1",
        "en_US",
        ["Test Outlet", "3 stars", "Test Customer", "1"]
      );

      if (!result.ok) {
        res.status(400).json({ error: "Failed to send template message" });
        return;
      }

      res.status(200).json({
        message: "WhatsApp template message sent successfully",
      });
    } catch (error) {
      logger.error("Failed to send test template message", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  }

  /**
   * ============================================================
   * OPENAI TEST ENDPOINT
   * ============================================================
   */

  /**
   * Test AI reply generation (matches your worker payload)
   */
  async generateAIReply(req: Request, res: Response): Promise<void> {
    try {
      const {
        rating,
        customerName,
        reviewText,
        outletName,
        storeLocation,
        businessCategory,
      } = req.body;

      if (rating == null || !customerName || !outletName || !storeLocation || !businessCategory) {
        res.status(400).json({
          error:
            "rating, customerName, reviewText, outletName, storeLocation, businessCategory are required",
        });
        return;
      }

      const reply = await openaiService.generateReply({
        rating: Number(rating),
        customerName: String(customerName),
        reviewText: String(reviewText || ""),
        outletName: String(outletName),
        storeLocation: String(storeLocation),
        businessCategory: String(businessCategory),
      });

      if (!reply) {
        res.status(400).json({ error: "Failed to generate reply" });
        return;
      }

      res.status(200).json({ reply });
    } catch (error) {
      logger.error("Failed to generate AI reply", error);
      res.status(500).json({ error: "Failed to generate reply" });
    }
  }
}

export const integrationsController = new IntegrationsController();
