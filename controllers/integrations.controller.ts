import type { Request, Response } from "express"
import type { AuthRequest } from "../middleware/auth.middleware"
import { whatsappService } from "../integrations/whatsapp"
import { gmbService } from "../integrations/gmb"
import { openaiService } from "../integrations/openai"
import { googleConnectTokenRepository } from "../repository/google-connect-token.repo"
import { googleIntegrationRepository } from "../repository/google-integration.repo"
import { logger } from "../utils/logger"

export class IntegrationsController {
  /**
   * Get Google OAuth URL
   */
  async getGoogleAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.query

      let authUrl: string

      if (token && typeof token === "string") {
        // Outlet-specific auth URL with state
        authUrl = gmbService.getAuthUrlWithState(token)
      } else {
        // Legacy system-level auth URL
        authUrl = gmbService.getAuthUrl()
      }

      res.status(200).json({
        authUrl,
      })
    } catch (error) {
      logger.error("Failed to get Google auth URL", error)
      res.status(500).json({ error: "Failed to get auth URL" })
    }
  }

  /**
   * Handle Google OAuth callback
   */
  async handleGoogleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query

      if (!code || typeof code !== "string") {
        res.status(400).json({ error: "Authorization code is required" })
        return
      }

      const refreshToken = await gmbService.exchangeCode(code)

      if (!refreshToken) {
        res.status(400).json({ error: "Failed to exchange authorization code" })
        return
      }

      if (state && typeof state === "string") {
        // Outlet-specific connection using token
        const connectToken = await googleConnectTokenRepository.findByToken(state)

        if (!connectToken) {
          res.status(400).json({ error: "Invalid or expired connect token" })
          return
        }

        if (connectToken.usedAt) {
          res.status(400).json({ error: "Connect token has already been used" })
          return
        }

        if (connectToken.expiresAt < new Date()) {
          res.status(400).json({ error: "Connect token has expired" })
          return
        }

        // Get Google account email (we'll need to make an API call to get this)
        // For now, we'll store with a placeholder and update later
        const googleEmail = "pending@google.com" // TODO: Get actual email from Google API

        // Create or update Google integration for the outlet
        await googleIntegrationRepository.create({
          outletId: connectToken.outletId,
          googleEmail,
          refreshToken
        })

        // Mark token as used
        await googleConnectTokenRepository.markAsUsed(state)

        logger.info(`Google OAuth callback processed for outlet: ${connectToken.outletId}`)

        res.status(200).json({
          message: "Google My Business account connected successfully to outlet",
          outletId: connectToken.outletId
        })
      } else {
        // Legacy system-level GMB integration - refresh token is stored in environment
        logger.info("Google OAuth callback processed for system GMB integration")

        res.status(200).json({
          message: "Google My Business account connected successfully",
          refreshToken,
        })
      }
    } catch (error) {
      logger.error("Failed to handle Google callback", error)
      res.status(500).json({ error: "Failed to connect Google account" })
    }
  }

  /**
   * Fetch GMB locations
   */
  async getGMBLocations(req: AuthRequest, res: Response): Promise<void> {
    try {
      const locations = await gmbService.listLocations()

      if (!locations) {
        res.status(400).json({ error: "Failed to fetch locations" })
        return
      }

      res.status(200).json({
        locations,
      })
    } catch (error) {
      logger.error("Failed to fetch GMB locations", error)
      res.status(500).json({ error: "Failed to fetch locations" })
    }
  }

  /**
   * WhatsApp webhook handler
   */
  async handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
    try {
      const hub = req.query.hub as any

      if (hub && hub.mode === "subscribe" && hub.verify_token) {
        const isValid = whatsappService.verifyWebhook(hub.verify_token as string)

        if (isValid) {
          res.status(200).send(hub.challenge)
          logger.info("WhatsApp webhook verified")
          return
        }

        res.status(403).json({ error: "Invalid verify token" })
        return
      }

      // Handle incoming messages
      const message = req.body

      logger.info("Received WhatsApp webhook", {
        from: message?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from,
      })

      res.status(200).json({ received: true })
    } catch (error) {
      logger.error("Failed to handle WhatsApp webhook", error)
      res.status(500).json({ error: "Failed to process webhook" })
    }
  }

  /**
   * Test WhatsApp message sending
   */
  async sendTestMessage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { phoneNumber, message } = req.body

      if (!phoneNumber || !message) {
        res.status(400).json({ error: "phoneNumber and message are required" })
        return
      }

      const success = await whatsappService.sendText(phoneNumber, message)

      if (!success.ok) {
        res.status(400).json({ error: "Failed to send message" })
        return
      }

      res.status(200).json({
        message: "Message sent successfully",
      })
    } catch (error) {
      logger.error("Failed to send test message", error)
      res.status(500).json({ error: "Failed to send message" })
    }
  }

  /**
   * Test AI reply generation
   */
  async generateAIReply(req: Request, res: Response): Promise<void> {
    try {
      const { reviewText, rating, outletName } = req.body

      if (!reviewText || !rating || !outletName) {
        res.status(400).json({
          error: "reviewText, rating, and outletName are required",
        })
        return
      }

      const reply = await openaiService.generateReply(reviewText, rating, outletName)

      if (!reply) {
        res.status(400).json({ error: "Failed to generate reply" })
        return
      }

      res.status(200).json({
        reply,
      })
    } catch (error) {
      logger.error("Failed to generate AI reply", error)
      res.status(500).json({ error: "Failed to generate reply" })
    }
  }

  /**
   * Fetch GMB locations for a specific outlet
   */
  async getGMBLocationsForOutlet(req: Request, res: Response): Promise<void> {
    try {
      const { outletId } = req.params

      if (!outletId) {
        res.status(400).json({ error: "Outlet ID is required" })
        return
      }

      // Get Google integration for the outlet
      const integration = await googleIntegrationRepository.findByOutletId(outletId)

      if (!integration) {
        res.status(400).json({ error: "No Google integration found for this outlet" })
        return
      }

      const locations = await gmbService.listLocations(integration.refreshToken)

      if (!locations) {
        res.status(400).json({ error: "Failed to fetch locations" })
        return
      }

      res.status(200).json({
        locations,
      })
    } catch (error) {
      logger.error("Failed to fetch GMB locations for outlet", error)
      res.status(500).json({ error: "Failed to fetch locations" })
    }
  }
}

export const integrationsController = new IntegrationsController()
