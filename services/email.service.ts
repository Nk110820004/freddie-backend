import nodemailer from "nodemailer"
import env from "../config/env"
import { logger } from "../utils/logger"

/**
 * Service for handling system emails (onboarding, alerts, etc.)
 */
class EmailService {
  private transporter: nodemailer.Transporter | null = null

  constructor() {
    this.initTransporter()
  }

  private initTransporter() {
    try {
      if (env.EMAIL_SERVICE === "gmail") {
        this.transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
        })
      } else {
        this.transporter = nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          },
        })
      }
    } catch (error) {
      logger.error("[v0] Email Service initialization failed", error)
    }
  }

  /**
   * Send onboarding email with temporary password
   */
  async sendOnboardingEmail(email: string, name: string, tempPassword: string) {
    if (!this.transporter) {
      logger.warn("[v0] Email transporter not initialized. Skipping onboarding email.")
      return false
    }

    const mailOptions = {
      from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
      to: email,
      subject: "Welcome to Freddie Admin Panel - Your Credentials",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Hello ${name},</h2>
          <p>An admin account has been created for you on the Freddie Customer Review Automation platform.</p>
          <p>Your temporary credentials are:</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>Email:</strong> ${email}<br/>
            <strong>Temporary Password:</strong> ${tempPassword}
          </div>
          <p>Please login at <a href="${env.ADMIN_PANEL_URL}">${env.ADMIN_PANEL_URL}</a> and change your password immediately.</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">This is an automated message. Please do not reply.</p>
        </div>
      `,
    }

    try {
      await this.transporter.sendMail(mailOptions)
      logger.info(`[v0] Onboarding email sent to ${email}`)
      return true
    } catch (error) {
      logger.error(`[v0] Failed to send onboarding email to ${email}`, error)
      return false
    }
  }
}

export const emailService = new EmailService()
