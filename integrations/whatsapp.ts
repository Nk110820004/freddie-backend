import axios from "axios";
import env from "../config/env";
import { logger } from "../utils/logger";

interface WhatsAppMessage {
  messaging_product: string;
  to: string;
  type: string;
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: string;
      parameters: Array<{
        type: string;
        text: string;
      }>;
    }>;
  };
  text?: {
    body: string;
  };
}

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

export class WhatsAppService {
  private baseUrl = "https://graph.facebook.com/v18.0";
  private phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  private accessToken = env.WHATSAPP_ACCESS_TOKEN;
  private rateLimitMap: Map<string, number[]> = new Map(); // Track message timestamps per number
  private readonly MAX_MESSAGES_PER_HOUR = 100; // Rate limit per phone number

  /**
   * Check rate limit for a phone number
   */
  private checkRateLimit(phoneNumber: string): boolean {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    let timestamps = this.rateLimitMap.get(phoneNumber) || [];
    timestamps = timestamps.filter((ts) => ts > oneHourAgo);

    if (timestamps.length >= this.MAX_MESSAGES_PER_HOUR) {
      logger.warn(
        `Rate limit exceeded for ${phoneNumber}: ${timestamps.length} messages in last hour`
      );
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
  private validatePhoneNumber(phoneNumber: string): boolean {
    const normalized = phoneNumber.replace(/\D/g, "");

    if (phoneNumber.includes("@g.us")) {
      logger.error(`Group messaging is NOT supported: ${phoneNumber}`);
      return false;
    }

    if (normalized.length < 7 || normalized.length > 15) {
      logger.warn(`Invalid phone number length: ${normalized.length}`);
      return false;
    }

    return true;
  }

  /**
   * Send a WhatsApp message using template
   * Note: Templates must be pre-approved in WhatsApp Business Manager
   */
  async sendTemplate(
    toNumber: string,
    templateName: string,
    languageCode: string = WA_LANG,
    parameters?: string[]
  ): Promise<{ ok: boolean; skipped?: boolean }> {
    try {
      if (!process.env.WHATSAPP_ACCESS_TOKEN) {
        logger.warn("WhatsApp disabled: missing access token");
        return { ok: false, skipped: true };
      }

      if (!this.accessToken || !this.phoneNumberId) {
        logger.warn("WhatsApp credentials not configured");
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

      const payload: WhatsAppMessage = {
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

      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      logger.info(`WhatsApp template sent to ${toNumber}`, {
        template: templateName,
        messageId: response.data?.messages?.[0]?.id,
      });

      return { ok: true };
    } catch (error) {
      logger.error(`Failed to send WhatsApp template to ${toNumber}`, error);
      return { ok: false };
    }
  }

  /**
   * ❌ DISABLED: Text messages not allowed by business requirement
   */
  async sendText(): Promise<{ ok: boolean; skipped?: boolean }> {
    throw new Error(
      "WhatsAppService.sendText() is disabled. Use template messages only via sendTemplate()."
    );
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
  async sendCriticalReviewAlert(
    toNumber: string,
    outletName: string,
    rating: number,
    customerName: string,
    reviewText: string,
    suggestedReply: string
  ): Promise<{ ok: boolean; skipped?: boolean }> {
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
  async sendManualReviewReminder(
    toNumber: string,
    outletName: string,
    customerName: string,
    rating: number,
    reminderNumber: number
  ): Promise<{ ok: boolean; skipped?: boolean }> {
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
  async sendEscalationNotice(
    toNumber: string,
    outletName: string,
    customerName: string,
    rating: number,
    hoursPending: number
  ): Promise<{ ok: boolean; skipped?: boolean }> {
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
  verifyWebhook(token: string): boolean {
    return token === env.WHATSAPP_VERIFY_TOKEN;
  }

  /**
   * Send multiple admins notification -> Template ONLY
   *
   * ✅ You can re-use reminder or escalation templates.
   * If you want custom admin template, create a new template and call sendTemplate().
   */
  async notifyAdmins(adminNumbers: string[], templateName: string, params: string[]): Promise<void> {
    const promises = adminNumbers.map((number) =>
      this.sendTemplate(number, templateName, WA_LANG, params)
    );
    await Promise.allSettled(promises);
  }
}

export const whatsappService = new WhatsAppService();
