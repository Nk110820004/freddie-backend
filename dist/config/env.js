"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    // Core
    NODE_ENV: zod_1.z.enum(["development", "production", "test"]).default("development"),
    PORT: zod_1.z.coerce.number().default(4000),
    BACKEND_BASE_URL: zod_1.z.string().url(),
    // Database
    DATABASE_URL: zod_1.z.string().url(),
    PRISMA_ACCELERATE_URL: zod_1.z.string().optional(),
    // CORS
    ADMIN_PANEL_URL: zod_1.z.string().url(),
    USER_APP_URL: zod_1.z.string().url(),
    // JWT
    JWT_ACCESS_SECRET: zod_1.z.string().min(32),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32),
    JWT_ACCESS_EXPIRY: zod_1.z.string().default("1h"),
    JWT_REFRESH_EXPIRY: zod_1.z.string().default("7d"),
    // Cookies
    AUTH_COOKIE_NAME: zod_1.z.string().default("auth_token"),
    REFRESH_COOKIE_NAME: zod_1.z.string().default("refresh_token"),
    COOKIE_DOMAIN: zod_1.z.string(),
    COOKIE_SECURE: zod_1.z
        .string()
        .transform((v) => v === "true")
        .default("false"),
    COOKIE_HTTP_ONLY: zod_1.z
        .string()
        .transform((v) => v === "true")
        .default("true"),
    COOKIE_SAME_SITE: zod_1.z.enum(["lax", "strict", "none"]).default("lax"),
    // 2FA
    TWOFA_ENCRYPTION_KEY: zod_1.z.string().min(32),
    TWOFA_WINDOW: zod_1.z.coerce.number().default(2),
    // Email
    EMAIL_SERVICE: zod_1.z.enum(["gmail", "resend", "sendgrid"]).default("gmail"),
    SMTP_HOST: zod_1.z.string().optional(),
    SMTP_PORT: zod_1.z.coerce.number().optional(),
    SMTP_USER: zod_1.z.string().optional(),
    SMTP_PASS: zod_1.z.string().optional(),
    SMTP_FROM_NAME: zod_1.z.string().default("Freddie Admin"),
    SMTP_FROM_EMAIL: zod_1.z.string().email().default("noreply@freddie.com"),
    RESEND_API_KEY: zod_1.z.string().optional(),
    SENDGRID_API_KEY: zod_1.z.string().optional(),
    // OpenAI
    OPENAI_API_KEY: zod_1.z.string().optional(),
    OPENAI_INPUT_MODEL: zod_1.z.string().default("gpt-5-mini"),
    OPENAI_OUTPUT_MODEL: zod_1.z.string().default("gpt-5"),
    OPENAI_MODEL: zod_1.z.string().default("gpt-5-mini"),
    OPENAI_MAX_TOKENS: zod_1.z.coerce.number().default(512),
    OPENAI_TEMPERATURE: zod_1.z.coerce.number().default(0.6),
    OPENAI_TIMEOUT: zod_1.z.coerce.number().default(30000),
    // Google My Business
    GOOGLE_CLIENT_ID: zod_1.z.string().optional(),
    GOOGLE_CLIENT_SECRET: zod_1.z.string().optional(),
    GOOGLE_PROJECT_ID: zod_1.z.string().optional(),
    GOOGLE_REDIRECT_URI: zod_1.z.string().url().optional(),
    GOOGLE_REFRESH_TOKEN: zod_1.z.string().optional(),
    GMB_ACCOUNT_NAME: zod_1.z.string().optional(),
    // WhatsApp
    WHATSAPP_BUSINESS_ACCOUNT_ID: zod_1.z.string().optional().or(zod_1.z.literal("")),
    WHATSAPP_PHONE_NUMBER_ID: zod_1.z.string().optional().or(zod_1.z.literal("")),
    WHATSAPP_PHONE_NUMBER: zod_1.z.string().optional().or(zod_1.z.literal("")),
    WHATSAPP_ACCESS_TOKEN: zod_1.z.string().optional().or(zod_1.z.literal("")),
    WHATSAPP_VERIFY_TOKEN: zod_1.z.string().optional().or(zod_1.z.literal("")),
    WHATSAPP_TEMPLATE_LOW_RATING: zod_1.z.string().optional(),
    WHATSAPP_TEMPLATE_REMINDER: zod_1.z.string().optional(),
    WHATSAPP_TEMPLATE_CONFIRMATION: zod_1.z.string().optional(),
    WHATSAPP_WEBHOOK_URL: zod_1.z.string().url().optional().or(zod_1.z.literal("")),
    // Razorpay
    RAZORPAY_KEY_ID: zod_1.z.string().optional(),
    RAZORPAY_KEY_SECRET: zod_1.z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: zod_1.z.string().optional(),
    RAZORPAY_CURRENCY: zod_1.z.string().default("INR"),
    RAZORPAY_RECEIPT_PREFIX: zod_1.z.string().default("FREDDIE_"),
    // Background Jobs
    GMB_POLLING_INTERVAL: zod_1.z.coerce.number().default(3600000),
    WHATSAPP_REMINDER_15M: zod_1.z.coerce.number().default(900000),
    WHATSAPP_REMINDER_2H: zod_1.z.coerce.number().default(7200000),
    WHATSAPP_REMINDER_6H: zod_1.z.coerce.number().default(21600000),
    WHATSAPP_REMINDER_12H: zod_1.z.coerce.number().default(43200000),
    WHATSAPP_REMINDER_24H: zod_1.z.coerce.number().default(86400000),
    // Security
    RATE_LIMIT_WINDOW: zod_1.z.coerce.number().default(15),
    RATE_LIMIT_MAX_REQUESTS: zod_1.z.coerce.number().default(100),
    MAX_LOGIN_ATTEMPTS: zod_1.z.coerce.number().default(5),
    LOGIN_LOCK_DURATION: zod_1.z.coerce.number().default(15),
    ADMIN_IP_WHITELIST: zod_1.z.string().optional(),
    // Logging
    LOG_LEVEL: zod_1.z.enum(["error", "warn", "info", "debug"]).default("info"),
    LOG_FILE_PATH: zod_1.z.string().default("./logs/app.log"),
    SENTRY_DSN: zod_1.z.string().optional(),
    // Feature Flags
    FEATURE_AI_REPLIES: zod_1.z
        .string()
        .transform((v) => v === "true")
        .default("true"),
    FEATURE_WHATSAPP_ALERTS: zod_1.z
        .string()
        .transform((v) => v === "true")
        .default("true"),
    FEATURE_AUTO_POLLING: zod_1.z
        .string()
        .transform((v) => v === "true")
        .default("true"),
    FEATURE_BILLING_GATING: zod_1.z
        .string()
        .transform((v) => v === "true")
        .default("true"),
});
exports.env = envSchema.parse(process.env);
// Export typed environment object
exports.default = exports.env;
//# sourceMappingURL=env.js.map