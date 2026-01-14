"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const integrations_controller_1 = require("../controllers/integrations.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Google My Business
router.get("/google/auth-url", integrations_controller_1.integrationsController.getGoogleAuthUrl.bind(integrations_controller_1.integrationsController));
router.get("/google/callback", integrations_controller_1.integrationsController.handleGoogleCallback.bind(integrations_controller_1.integrationsController));
router.get("/google/locations", auth_middleware_1.requireAuth, integrations_controller_1.integrationsController.getGMBLocations.bind(integrations_controller_1.integrationsController));
// WhatsApp
router.post("/whatsapp/webhook", integrations_controller_1.integrationsController.handleWhatsAppWebhook.bind(integrations_controller_1.integrationsController));
router.post("/whatsapp/test", auth_middleware_1.requireAuth, integrations_controller_1.integrationsController.sendTestMessage.bind(integrations_controller_1.integrationsController));
// OpenAI
router.post("/openai/generate-reply", integrations_controller_1.integrationsController.generateAIReply.bind(integrations_controller_1.integrationsController));
exports.default = router;
//# sourceMappingURL=integrations.routes.js.map