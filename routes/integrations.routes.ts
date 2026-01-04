import { Router } from "express"
import { integrationsController } from "../controllers/integrations.controller"
import { requireAuth } from "../middleware/auth.middleware"

const router = Router()

// Google My Business
router.get("/google/auth-url", integrationsController.getGoogleAuthUrl.bind(integrationsController))
router.get(
  "/google/callback",
  requireAuth,
  integrationsController.handleGoogleCallback.bind(integrationsController),
)
router.get("/google/locations", requireAuth, integrationsController.getGMBLocations.bind(integrationsController))

// WhatsApp
router.post("/whatsapp/webhook", integrationsController.handleWhatsAppWebhook.bind(integrationsController))
router.post("/whatsapp/test", requireAuth, integrationsController.sendTestMessage.bind(integrationsController))

// OpenAI
router.post("/openai/generate-reply", integrationsController.generateAIReply.bind(integrationsController))

export default router
