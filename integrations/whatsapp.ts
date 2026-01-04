import axios from "axios"
import env from "../config/env"
import { logger } from "../utils/logger"

interface WhatsAppMessage {
  messaging_product: string
  to: string
  type: string
  template?: {
    name: string
    language: {
      code: string
    }
    components?: Array<{
      type: string
      parameters: Array<{
        type: string
        text: string
      }>
    }>
  }
  text?: {
    body: string
  }
}

export class WhatsAppService {
  private baseUrl = "https://graph.facebook.com/v18.0"
  private phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID
  private accessToken = env.WHATSAPP_ACCESS_TOKEN

  /**
   * Send a WhatsApp message using template
   * Note: Templates must be pre-approved in WhatsApp Business Manager
   */
  async sendTemplate(toNumber: string, templateName: string, parameters?: string[]): Promise<boolean> {
    try {
      if (!this.accessToken || !this.phoneNumberId) {
        logger.warn("WhatsApp credentials not configured")
        return false
      }

      const components = []
      if (parameters && parameters.length > 0) {
        components.push({
          type: "body",
          parameters: parameters.map((text) => ({ type: "text", text })),
        })
      }

      const payload: WhatsAppMessage = {
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
      }

      const response = await axios.post(`${this.baseUrl}/${this.phoneNumberId}/messages`, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      })

      logger.info(`WhatsApp template sent to ${toNumber}`, {
        template: templateName,
        messageId: response.data?.messages?.[0]?.id,
      })

      return true
    } catch (error) {
      logger.error(`Failed to send WhatsApp template to ${toNumber}`, error)
      return false
    }
  }

  /**
   * Send a text message (requires active 24-hour session window)
   * For notifications, use templates instead
   */
  async sendText(toNumber: string, message: string): Promise<boolean> {
    try {
      if (!this.accessToken || !this.phoneNumberId) {
        logger.warn("WhatsApp credentials not configured")
        return false
      }

      const payload: WhatsAppMessage = {
        messaging_product: "whatsapp",
        to: toNumber.replace(/\D/g, ""),
        type: "text",
        text: {
          body: message,
        },
      }

      const response = await axios.post(`${this.baseUrl}/${this.phoneNumberId}/messages`, payload, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      })

      logger.info(`WhatsApp text sent to ${toNumber}`, {
        messageId: response.data?.messages?.[0]?.id,
      })

      return true
    } catch (error) {
      logger.error(`Failed to send WhatsApp text to ${toNumber}`, error)
      return false
    }
  }

  /**
   * Send critical review alert (1-3 stars)
   */
  async sendCriticalReviewAlert(
    toNumber: string,
    outletName: string,
    rating: number,
    customerName: string,
    reviewText: string,
  ): Promise<boolean> {
    const message = `CRITICAL REVIEW ALERT

Outlet: ${outletName}
Rating: ${rating} star${rating !== 1 ? "s" : ""}
Customer: ${customerName}
Review: "${reviewText.substring(0, 200)}${reviewText.length > 200 ? "..." : ""}"

ACTION REQUIRED: Manual reply needed. Login to the admin dashboard to respond.`

    return this.sendText(toNumber, message)
  }

  /**
   * Send reminder for pending manual review
   */
  async sendManualReviewReminder(
    toNumber: string,
    outletName: string,
    customerName: string,
    rating: number,
    reminderNumber: number,
  ): Promise<boolean> {
    const message = `REMINDER #${reminderNumber} - Pending Review Reply

Outlet: ${outletName}
Customer: ${customerName}
Rating: ${rating} star${rating !== 1 ? "s" : ""}

This review still requires your manual response. Please login to the dashboard to reply.`

    return this.sendText(toNumber, message)
  }

  /**
   * Send escalation notice
   */
  async sendEscalationNotice(
    toNumber: string,
    outletName: string,
    customerName: string,
    rating: number,
    hoursPending: number,
  ): Promise<boolean> {
    const message = `ESCALATED - Review Response Overdue

Outlet: ${outletName}
Customer: ${customerName}
Rating: ${rating} stars
Pending for: ${hoursPending} hours

URGENT: This review has been escalated due to no response. Immediate action required.`

    return this.sendText(toNumber, message)
  }

  /**
   * Verify webhook token
   */
  verifyWebhook(token: string): boolean {
    return token === env.WHATSAPP_VERIFY_TOKEN
  }

  /**
   * Send multiple admins notification
   */
  async notifyAdmins(adminNumbers: string[], message: string): Promise<void> {
    const promises = adminNumbers.map((number) => this.sendText(number, message))
    await Promise.allSettled(promises)
  }
}

export const whatsappService = new WhatsAppService()
