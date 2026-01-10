"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappService = exports.WhatsAppService = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = __importDefault(require("../config/env"));
const logger_1 = require("../utils/logger");
class WhatsAppService {
    constructor() {
        this.baseUrl = "https://graph.facebook.com/v18.0";
        this.phoneNumberId = env_1.default.WHATSAPP_PHONE_NUMBER_ID;
        this.accessToken = env_1.default.WHATSAPP_ACCESS_TOKEN;
        this.rateLimitMap = new Map(); // Track message timestamps per number
        this.MAX_MESSAGES_PER_HOUR = 100; // Rate limit per phone number
    }
    /**
     * Check rate limit for a phone number
     */
    checkRateLimit(phoneNumber) {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        let timestamps = this.rateLimitMap.get(phoneNumber) || [];
        timestamps = timestamps.filter(ts => ts > oneHourAgo);
        if (timestamps.length >= this.MAX_MESSAGES_PER_HOUR) {
            logger_1.logger.warn(`Rate limit exceeded for ${phoneNumber}: ${timestamps.length} messages in last hour`);
            return false;
        }
        timestamps.push(now);
        this.rateLimitMap.set(phoneNumber, timestamps);
        return true;
    }
    /**
     * Validate phone number is 1:1 (not group)
     * WhatsApp Business API only supports 1:1 messaging
     * Group messaging is NOT supported and should be explicitly forbidden
     */
    validatePhoneNumber(phoneNumber) {
        // Normalize: remove all non-digits
        const normalized = phoneNumber.replace(/\D/g, "");
        // WhatsApp groups have special format (e.g., "123-456@g.us")
        // Business API only allows individual numbers (e.g., "123456789@s.whatsapp.net")
        // Our system should only store and use individual phone numbers
        if (phoneNumber.includes("@g.us")) {
            logger_1.logger.error(`Group messaging is NOT supported: ${phoneNumber}`);
            return false;
        }
        // Basic validation: should be 7-15 digits (international standard)
        if (normalized.length < 7 || normalized.length > 15) {
            logger_1.logger.warn(`Invalid phone number length: ${normalized.length}`);
            return false;
        }
        return true;
    }
    /**
     * Send a WhatsApp message using template
     * Note: Templates must be pre-approved in WhatsApp Business Manager
     */
    async sendTemplate(toNumber, templateName, parameters) {
        try {
            if (!this.accessToken || !this.phoneNumberId) {
                logger_1.logger.warn("WhatsApp credentials not configured");
                return false;
            }
            // CRITICAL: Validate this is not a group
            if (!this.validatePhoneNumber(toNumber)) {
                return false;
            }
            // Check rate limit
            if (!this.checkRateLimit(toNumber)) {
                return false;
            }
            const components = [];
            if (parameters && parameters.length > 0) {
                components.push({
                    type: "body",
                    parameters: parameters.map((text) => ({ type: "text", text })),
                });
            }
            const payload = {
                messaging_product: "whatsapp",
                to: toNumber.replace(/\D/g, ""),
                type: "template",
                template: {
                    name: templateName,
                    language: {
                        code: "en_US",
                    },
                    components: components.length > 0 ? components : undefined,
                },
            };
            const response = await axios_1.default.post(`${this.baseUrl}/${this.phoneNumberId}/messages`, payload, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    "Content-Type": "application/json",
                },
            });
            logger_1.logger.info(`WhatsApp template sent to ${toNumber}`, {
                template: templateName,
                messageId: response.data?.messages?.[0]?.id,
            });
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Failed to send WhatsApp template to ${toNumber}`, error);
            return false;
        }
    }
    /**
     * Send a text message (requires active 24-hour session window)
     * For notifications, use templates instead
     * CRITICAL: This is 1:1 only - group messaging is explicitly forbidden
     */
    async sendText(toNumber, message) {
        try {
            if (!this.accessToken || !this.phoneNumberId) {
                logger_1.logger.warn("WhatsApp credentials not configured");
                return false;
            }
            // CRITICAL: Validate this is not a group
            if (!this.validatePhoneNumber(toNumber)) {
                return false;
            }
            // Check rate limit
            if (!this.checkRateLimit(toNumber)) {
                return false;
            }
            const payload = {
                messaging_product: "whatsapp",
                to: toNumber.replace(/\D/g, ""),
                type: "text",
                text: {
                    body: message,
                },
            };
            const response = await axios_1.default.post(`${this.baseUrl}/${this.phoneNumberId}/messages`, payload, {
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    "Content-Type": "application/json",
                },
            });
            logger_1.logger.info(`WhatsApp text sent to ${toNumber}`, {
                messageId: response.data?.messages?.[0]?.id,
            });
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Failed to send WhatsApp text to ${toNumber}`, error);
            return false;
        }
    }
    /**
     * Send critical review alert (1-3 stars)
     */
    async sendCriticalReviewAlert(toNumber, outletName, rating, customerName, reviewText) {
        const message = `CRITICAL REVIEW ALERT

Outlet: ${outletName}
Rating: ${rating} star${rating !== 1 ? "s" : ""}
Customer: ${customerName}
Review: "${reviewText.substring(0, 200)}${reviewText.length > 200 ? "..." : ""}"

ACTION REQUIRED: Manual reply needed. Login to the admin dashboard to respond.`;
        return this.sendText(toNumber, message);
    }
    /**
     * Send reminder for pending manual review
     */
    async sendManualReviewReminder(toNumber, outletName, customerName, rating, reminderNumber) {
        const message = `REMINDER #${reminderNumber} - Pending Review Reply

Outlet: ${outletName}
Customer: ${customerName}
Rating: ${rating} star${rating !== 1 ? "s" : ""}

This review still requires your manual response. Please login to the dashboard to reply.`;
        return this.sendText(toNumber, message);
    }
    /**
     * Send escalation notice
     */
    async sendEscalationNotice(toNumber, outletName, customerName, rating, hoursPending) {
        const message = `ESCALATED - Review Response Overdue

Outlet: ${outletName}
Customer: ${customerName}
Rating: ${rating} stars
Pending for: ${hoursPending} hours

URGENT: This review has been escalated due to no response. Immediate action required.`;
        return this.sendText(toNumber, message);
    }
    /**
     * Verify webhook token
     */
    verifyWebhook(token) {
        return token === env_1.default.WHATSAPP_VERIFY_TOKEN;
    }
    /**
     * Send multiple admins notification
     */
    async notifyAdmins(adminNumbers, message) {
        const promises = adminNumbers.map((number) => this.sendText(number, message));
        await Promise.allSettled(promises);
    }
}
exports.WhatsAppService = WhatsAppService;
exports.whatsappService = new WhatsAppService();
//# sourceMappingURL=whatsapp.js.map