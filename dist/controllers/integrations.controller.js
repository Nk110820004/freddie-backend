"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationsController = exports.IntegrationsController = void 0;
const whatsapp_1 = require("../integrations/whatsapp");
const gmb_1 = require("../integrations/gmb");
const openai_1 = require("../integrations/openai");
const logger_1 = require("../utils/logger");
class IntegrationsController {
    /**
     * Get Google OAuth URL
     */
    async getGoogleAuthUrl(req, res) {
        try {
            const authUrl = gmb_1.gmbService.getAuthUrl();
            res.status(200).json({
                authUrl,
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to get Google auth URL", error);
            res.status(500).json({ error: "Failed to get auth URL" });
        }
    }
    /**
     * Handle Google OAuth callback
     */
    async handleGoogleCallback(req, res) {
        try {
            const { code } = req.query;
            if (!code || typeof code !== "string") {
                res.status(400).json({ error: "Authorization code is required" });
                return;
            }
            const refreshToken = await gmb_1.gmbService.exchangeCode(code);
            if (!refreshToken) {
                res.status(400).json({ error: "Failed to exchange authorization code" });
                return;
            }
            // In production, save refreshToken to user's profile
            logger_1.logger.info("Google OAuth callback processed", {
                userId: req.userId,
            });
            res.status(200).json({
                message: "Google account connected successfully",
                refreshToken,
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to handle Google callback", error);
            res.status(500).json({ error: "Failed to connect Google account" });
        }
    }
    /**
     * Fetch GMB locations
     */
    async getGMBLocations(req, res) {
        try {
            const locations = await gmb_1.gmbService.listLocations();
            if (!locations) {
                res.status(400).json({ error: "Failed to fetch locations" });
                return;
            }
            res.status(200).json({
                locations,
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch GMB locations", error);
            res.status(500).json({ error: "Failed to fetch locations" });
        }
    }
    /**
     * WhatsApp webhook handler
     */
    async handleWhatsAppWebhook(req, res) {
        try {
            const hub = req.query.hub;
            if (hub && hub.mode === "subscribe" && hub.verify_token) {
                const isValid = whatsapp_1.whatsappService.verifyWebhook(hub.verify_token);
                if (isValid) {
                    res.status(200).send(hub.challenge);
                    logger_1.logger.info("WhatsApp webhook verified");
                    return;
                }
                res.status(403).json({ error: "Invalid verify token" });
                return;
            }
            // Handle incoming messages
            const message = req.body;
            logger_1.logger.info("Received WhatsApp webhook", {
                from: message?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from,
            });
            res.status(200).json({ received: true });
        }
        catch (error) {
            logger_1.logger.error("Failed to handle WhatsApp webhook", error);
            res.status(500).json({ error: "Failed to process webhook" });
        }
    }
    /**
     * Test WhatsApp message sending
     */
    async sendTestMessage(req, res) {
        try {
            const { phoneNumber, message } = req.body;
            if (!phoneNumber || !message) {
                res.status(400).json({ error: "phoneNumber and message are required" });
                return;
            }
            const success = await whatsapp_1.whatsappService.sendText(phoneNumber, message);
            if (!success.ok) {
                res.status(400).json({ error: "Failed to send message" });
                return;
            }
            res.status(200).json({
                message: "Message sent successfully",
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to send test message", error);
            res.status(500).json({ error: "Failed to send message" });
        }
    }
    /**
     * Test AI reply generation
     */
    async generateAIReply(req, res) {
        try {
            const { reviewText, rating, outletName } = req.body;
            if (!reviewText || !rating || !outletName) {
                res.status(400).json({
                    error: "reviewText, rating, and outletName are required",
                });
                return;
            }
            const reply = await openai_1.openaiService.generateReply(reviewText, rating, outletName);
            if (!reply) {
                res.status(400).json({ error: "Failed to generate reply" });
                return;
            }
            res.status(200).json({
                reply,
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to generate AI reply", error);
            res.status(500).json({ error: "Failed to generate reply" });
        }
    }
}
exports.IntegrationsController = IntegrationsController;
exports.integrationsController = new IntegrationsController();
//# sourceMappingURL=integrations.controller.js.map