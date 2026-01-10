"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = __importDefault(require("../config/env"));
const logger_1 = require("../utils/logger");
/**
 * Service for handling system emails (onboarding, alerts, etc.)
 */
class EmailService {
    constructor() {
        this.transporter = null;
        this.initTransporter();
    }
    initTransporter() {
        try {
            if (env_1.default.EMAIL_SERVICE === "gmail") {
                this.transporter = nodemailer_1.default.createTransport({
                    service: "gmail",
                    auth: {
                        user: env_1.default.SMTP_USER,
                        pass: env_1.default.SMTP_PASS,
                    },
                });
            }
            else {
                this.transporter = nodemailer_1.default.createTransport({
                    host: env_1.default.SMTP_HOST,
                    port: env_1.default.SMTP_PORT,
                    secure: env_1.default.SMTP_PORT === 465,
                    auth: {
                        user: env_1.default.SMTP_USER,
                        pass: env_1.default.SMTP_PASS,
                    },
                });
            }
        }
        catch (error) {
            logger_1.logger.error("[v0] Email Service initialization failed", error);
        }
    }
    /**
     * Send onboarding email with temporary password
     */
    async sendOnboardingEmail(email, name, tempPassword) {
        if (!this.transporter) {
            logger_1.logger.warn("[v0] Email transporter not initialized. Skipping onboarding email.");
            return false;
        }
        const mailOptions = {
            from: `"${env_1.default.SMTP_FROM_NAME}" <${env_1.default.SMTP_FROM_EMAIL}>`,
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
          <p>Please login at <a href="${env_1.default.ADMIN_PANEL_URL}">${env_1.default.ADMIN_PANEL_URL}</a> and change your password immediately.</p>
          <hr/>
          <p style="font-size: 12px; color: #666;">This is an automated message. Please do not reply.</p>
        </div>
      `,
        };
        try {
            await this.transporter.sendMail(mailOptions);
            logger_1.logger.info(`[v0] Onboarding email sent to ${email}`);
            return true;
        }
        catch (error) {
            logger_1.logger.error(`[v0] Failed to send onboarding email to ${email}`, error);
            return false;
        }
    }
}
exports.emailService = new EmailService();
//# sourceMappingURL=email.service.js.map