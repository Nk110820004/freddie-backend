import dotenv from "dotenv"
import { z } from "zod"

dotenv.config()

const envSchema = z.object({
  // Core
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  BACKEND_BASE_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().url(),
  PRISMA_ACCELERATE_URL: z.string().optional(),

  // CORS
  ADMIN_PANEL_URL: z.string().url(),
  USER_APP_URL: z.string().url(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default("1h"),
  JWT_REFRESH_EXPIRY: z.string().default("7d"),

  // Cookies
  AUTH_COOKIE_NAME: z.string().default("auth_token"),
  REFRESH_COOKIE_NAME: z.string().default("refresh_token"),
  COOKIE_DOMAIN: z.string(),
  COOKIE_SECURE: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  COOKIE_HTTP_ONLY: z
    .string()
    .transform((v) => v === "true")
    .default("true"),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),

  // 2FA
  TWOFA_ENCRYPTION_KEY: z.string().min(32),
  TWOFA_WINDOW: z.coerce.number().default(2),

  // Email
  EMAIL_SERVICE: z.enum(["gmail", "resend", "sendgrid"]).default("gmail"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_NAME: z.string().default("Freddie Admin"),
  SMTP_FROM_EMAIL: z.string().email().default("noreply@freddie.com"),
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_INPUT_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_OUTPUT_MODEL: z.string().default("gpt-5"),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_MAX_TOKENS: z.coerce.number().default(512),
  OPENAI_TEMPERATURE: z.coerce.number().default(0.6),
  OPENAI_TIMEOUT: z.coerce.number().default(30000),

  // Google My Business
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_PROJECT_ID: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GMB_ACCOUNT_NAME: z.string().optional(),

  // WhatsApp
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional().or(z.literal("")),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().or(z.literal("")),
  WHATSAPP_PHONE_NUMBER: z.string().optional().or(z.literal("")),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().or(z.literal("")),
  WHATSAPP_VERIFY_TOKEN: z.string().optional().or(z.literal("")),
  WHATSAPP_TEMPLATE_LOW_RATING: z.string().optional(),
  WHATSAPP_TEMPLATE_REMINDER: z.string().optional(),
  WHATSAPP_TEMPLATE_CONFIRMATION: z.string().optional(),
  WHATSAPP_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),

  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_CURRENCY: z.string().default("INR"),
  RAZORPAY_RECEIPT_PREFIX: z.string().default("FREDDIE_"),

  // Background Jobs
  GMB_POLLING_INTERVAL: z.coerce.number().default(3600000),
  WHATSAPP_REMINDER_15M: z.coerce.number().default(900000),
  WHATSAPP_REMINDER_2H: z.coerce.number().default(7200000),
  WHATSAPP_REMINDER_6H: z.coerce.number().default(21600000),
  WHATSAPP_REMINDER_12H: z.coerce.number().default(43200000),
  WHATSAPP_REMINDER_24H: z.coerce.number().default(86400000),

  // Security
  RATE_LIMIT_WINDOW: z.coerce.number().default(15),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  LOGIN_LOCK_DURATION: z.coerce.number().default(15),
  ADMIN_IP_WHITELIST: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  LOG_FILE_PATH: z.string().default("./logs/app.log"),
  SENTRY_DSN: z.string().optional(),

  // Feature Flags
  FEATURE_AI_REPLIES: z
    .string()
    .transform((v) => v === "true")
    .default("true"),
  FEATURE_WHATSAPP_ALERTS: z
    .string()
    .transform((v) => v === "true")
    .default("true"),
  FEATURE_AUTO_POLLING: z
    .string()
    .transform((v) => v === "true")
    .default("true"),
  FEATURE_BILLING_GATING: z
    .string()
    .transform((v) => v === "true")
    .default("true"),
})

export const env = envSchema.parse(process.env)

// Export typed environment object
export default env
