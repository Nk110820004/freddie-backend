"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappService = exports.WhatsAppService = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = __importDefault(require("../config/env"));
const logger_1 = require("../utils/logger");
/**
 * ============================================================
 * TEMPLATE-ONLY WHATSAPP POLICY (ENFORCED)
 * ============================================================
 * Requirement:
 * ✅ WhatsApp ONLY template messages must be sent.
 *
 * So:
 * - sendTemplate() is allowed
 * - sendText() is DISABLED
 * - Alerts/reminders/escalations are template-based
 *
 * You must create + approve these templates in WhatsApp Manager:
 *
 * 1) freddie_low_rating_review_v1 (en_US)
 *    Body:
 *    ⚠️ New low rating Google review
 *    Outlet: {{1}}
 *    Rating: {{2}}
 *    Customer: {{3}}
 *    Review: {{4}}
 *    Suggested reply: {{5}}
 *
 * 2) freddie_manual_review_reminder_v1 (en_US)
 *    Body:
 *    ⏰ Reminder: Google review reply pending
 *    Outlet: {{1}}
 *    Rating: {{2}}
 *    Customer: {{3}}
 *    Reminder #: {{4}}
 *
 * 3) freddie_review_escalation_v1 (en_US)
 *    Body:
 *    🚨 Escalated: Review response overdue
 *    Outlet: {{1}}
 *    Rating: {{2}}
 *    Customer: {{3}}
 *    Pending hours: {{4}}
 *
 * NOTE:
 * These template names are hardcoded so your system is stable.
 */
const WA_LANG = "en_US";
const WA_TPL_LOW_RATING = "freddie_low_rating_review_v1";
const WA_TPL_REMINDER = "freddie_manual_review_reminder_v1";
const WA_TPL_ESCALATION = "freddie_review_escalation_v1";
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
        const oneHourAgo = now - 60 * 60 * 1000;
        let timestamps = this.rateLimitMap.get(phoneNumber) || [];
        timestamps = timestamps.filter((ts) => ts > oneHourAgo);
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
     */
    validatePhoneNumber(phoneNumber) {
        const normalized = phoneNumber.replace(/\D/g, "");
        if (phoneNumber.includes("@g.us")) {
            logger_1.logger.error(`Group messaging is NOT supported: ${phoneNumber}`);
            return false;
        }
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
    async sendTemplate(toNumber, templateName, languageCode = WA_LANG, parameters) {
        try {
            if (!process.env.WHATSAPP_ACCESS_TOKEN) {
                logger_1.logger.warn("WhatsApp disabled: missing access token");
                return { ok: false, skipped: true };
            }
            if (!this.accessToken || !this.phoneNumberId) {
                logger_1.logger.warn("WhatsApp credentials not configured");
                return { ok: false, skipped: true };
            }
            if (!this.validatePhoneNumber(toNumber)) {
                return { ok: false };
            }
            if (!this.checkRateLimit(toNumber)) {
                return { ok: false };
            }
            const components = [];
            if (parameters && parameters.length > 0) {
                components.push({
                    type: "body",
                    parameters: parameters.map((text) => ({ type: "text", text: String(text ?? "") })),
                });
            }
            const payload = {
                messaging_product: "whatsapp",
                to: toNumber.replace(/\D/g, ""),
                type: "template",
                template: {
                    name: templateName,
                    language: {
                        code: languageCode,
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
            return { ok: true };
        }
        catch (error) {
            logger_1.logger.error(`Failed to send WhatsApp template to ${toNumber}`, error);
            return { ok: false };
        }
    }
    /**
     * ❌ DISABLED: Text messages not allowed by business requirement
     */
    async sendText() {
        throw new Error("WhatsAppService.sendText() is disabled. Use template messages only via sendTemplate().");
    }
    /**
     * ✅ Critical review alert (1-3 stars) -> Template ONLY
     *
     * Template: freddie_low_rating_review_v1
     * Params:
     *  {{1}} outletName
     *  {{2}} rating
     *  {{3}} customerName
     *  {{4}} reviewText
     *  {{5}} suggestedReply
     */
    async sendCriticalReviewAlert(toNumber, outletName, rating, customerName, reviewText, suggestedReply) {
        return this.sendTemplate(toNumber, WA_TPL_LOW_RATING, WA_LANG, [
            outletName,
            `${rating} star${rating !== 1 ? "s" : ""}`,
            customerName,
            (reviewText || "(no message)").substring(0, 250),
            (suggestedReply || "").substring(0, 300),
        ]);
    }
    /**
     * ✅ Manual review reminder -> Template ONLY
     *
     * Template: freddie_manual_review_reminder_v1
     * Params:
     *  {{1}} outletName
     *  {{2}} rating
     *  {{3}} customerName
     *  {{4}} reminderNumber
     */
    async sendManualReviewReminder(toNumber, outletName, customerName, rating, reminderNumber) {
        return this.sendTemplate(toNumber, WA_TPL_REMINDER, WA_LANG, [
            outletName,
            `${rating} star${rating !== 1 ? "s" : ""}`,
            customerName,
            String(reminderNumber),
        ]);
    }
    /**
     * ✅ Escalation notice -> Template ONLY
     *
     * Template: freddie_review_escalation_v1
     * Params:
     *  {{1}} outletName
     *  {{2}} rating
     *  {{3}} customerName
     *  {{4}} hoursPending
     */
    async sendEscalationNotice(toNumber, outletName, customerName, rating, hoursPending) {
        return this.sendTemplate(toNumber, WA_TPL_ESCALATION, WA_LANG, [
            outletName,
            `${rating} star${rating !== 1 ? "s" : ""}`,
            customerName,
            String(hoursPending),
        ]);
    }
    /**
     * Verify webhook token
     */
    verifyWebhook(token) {
        return token === env_1.default.WHATSAPP_VERIFY_TOKEN;
    }
    /**
     * Send multiple admins notification -> Template ONLY
     *
     * ✅ You can re-use reminder or escalation templates.
     * If you want custom admin template, create a new template and call sendTemplate().
     */
    async notifyAdmins(adminNumbers, templateName, params) {
        const promises = adminNumbers.map((number) => this.sendTemplate(number, templateName, WA_LANG, params));
        await Promise.allSettled(promises);
    }
}
exports.WhatsAppService = WhatsAppService;
exports.whatsappService = new WhatsAppService();
//# sourceMappingURL=whatsapp.js.map