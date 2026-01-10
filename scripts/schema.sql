-- ===========================
-- ENUM TYPES
-- ===========================

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OutletStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BusinessCategory" AS ENUM ('HOTEL', 'RESTAURANT', 'GYM', 'CLINIC', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionPlan" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INACTIVE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApiStatus" AS ENUM ('ENABLED', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM (
    'PENDING',
    'AUTO_REPLIED',
    'MANUAL_PENDING',
    'CLOSED',
    'ESCALATED',
    'COMPLETED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ManualQueueStatus" AS ENUM ('PENDING', 'RESPONDED', 'ESCALATED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;


-- ===========================
-- TABLES
-- ===========================

-- ---------- User ----------
CREATE TABLE IF NOT EXISTS "User" (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL UNIQUE,
  "passwordHash"        TEXT NOT NULL,
  role                  "UserRole" NOT NULL DEFAULT 'USER',

  "twoFactorEnabled"    BOOLEAN NOT NULL DEFAULT FALSE,
  "twoFactorSecret"     TEXT,
  "twoFactorVerified"   BOOLEAN NOT NULL DEFAULT FALSE,

  "lastLoginAt"         TIMESTAMP(3),
  "lastLoginIp"         TEXT,

  "phoneNumber"         TEXT,
  "googleEmail"         TEXT,
  "googleProfileId"     TEXT,
  "googleRefreshToken"  TEXT,
  "gmbAccountId"        TEXT,
  "whatsappNumber"      TEXT,

  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "deletedAt"           TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"(email);
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"(role);
CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");


-- ---------- Outlet ----------
CREATE TABLE IF NOT EXISTS "Outlet" (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  "groupName"           TEXT,

  "primaryContactName"  TEXT NOT NULL,
  "contactEmail"        TEXT NOT NULL UNIQUE,
  "contactPhone"        TEXT NOT NULL UNIQUE,

  category              "BusinessCategory" NOT NULL DEFAULT 'OTHER',
  "subscriptionPlan"    "SubscriptionPlan" NOT NULL DEFAULT 'MONTHLY',

  "subscriptionStatus"  "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "apiStatus"           "ApiStatus" NOT NULL DEFAULT 'DISABLED',
  "onboardingStatus"    "OnboardingStatus" NOT NULL DEFAULT 'PENDING',
  status                "OutletStatus" NOT NULL DEFAULT 'ACTIVE',

  "googlePlaceId"       TEXT,
  "googleLocationName"  TEXT,

  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  "userId"              TEXT NOT NULL,

  CONSTRAINT "Outlet_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Outlet_userId_idx" ON "Outlet"("userId");
CREATE INDEX IF NOT EXISTS "Outlet_status_idx" ON "Outlet"(status);
CREATE INDEX IF NOT EXISTS "Outlet_subscriptionStatus_idx" ON "Outlet"("subscriptionStatus");
CREATE INDEX IF NOT EXISTS "Outlet_apiStatus_idx" ON "Outlet"("apiStatus");
CREATE INDEX IF NOT EXISTS "Outlet_onboardingStatus_idx" ON "Outlet"("onboardingStatus");


-- ---------- Review ----------
CREATE TABLE IF NOT EXISTS "Review" (
  id                TEXT PRIMARY KEY,
  "googleReviewId"   TEXT,
  rating            INT NOT NULL,
  "customerName"    TEXT NOT NULL,
  "reviewText"      TEXT NOT NULL,
  "aiReplyText"     TEXT,
  "manualReplyText" TEXT,
  status            "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  platform          TEXT NOT NULL DEFAULT 'GMB',

  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  "outletId"        TEXT NOT NULL,

  CONSTRAINT "Review_outletId_fkey"
    FOREIGN KEY ("outletId") REFERENCES "Outlet"(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Review_outletId_idx" ON "Review"("outletId");
CREATE INDEX IF NOT EXISTS "Review_status_idx" ON "Review"(status);
CREATE INDEX IF NOT EXISTS "Review_rating_idx" ON "Review"(rating);
CREATE INDEX IF NOT EXISTS "Review_createdAt_idx" ON "Review"("createdAt");
CREATE INDEX IF NOT EXISTS "Review_googleReviewId_idx" ON "Review"("googleReviewId");


-- ---------- ManualReviewQueue ----------
CREATE TABLE IF NOT EXISTS "ManualReviewQueue" (
  id                TEXT PRIMARY KEY,

  "reviewId"        TEXT NOT NULL UNIQUE,
  "outletId"        TEXT NOT NULL,

  "assignedAdminId" TEXT,

  "reminderCount"   INT NOT NULL DEFAULT 0,
  "nextReminderAt"  TIMESTAMP(3),
  status            "ManualQueueStatus" NOT NULL DEFAULT 'PENDING',

  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "ManualReviewQueue_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "Review"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "ManualReviewQueue_outletId_fkey"
    FOREIGN KEY ("outletId") REFERENCES "Outlet"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "ManualReviewQueue_assignedAdminId_fkey"
    FOREIGN KEY ("assignedAdminId") REFERENCES "User"(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ManualReviewQueue_reviewId_idx" ON "ManualReviewQueue"("reviewId");
CREATE INDEX IF NOT EXISTS "ManualReviewQueue_outletId_idx" ON "ManualReviewQueue"("outletId");
CREATE INDEX IF NOT EXISTS "ManualReviewQueue_assignedAdminId_idx" ON "ManualReviewQueue"("assignedAdminId");
CREATE INDEX IF NOT EXISTS "ManualReviewQueue_status_idx" ON "ManualReviewQueue"(status);
CREATE INDEX IF NOT EXISTS "ManualReviewQueue_nextReminderAt_idx" ON "ManualReviewQueue"("nextReminderAt");


-- ---------- Billing ----------
CREATE TABLE IF NOT EXISTS "Billing" (
  id            TEXT PRIMARY KEY,
  status        "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "trialEndsAt" TIMESTAMP(3),
  "paidUntil"   TIMESTAMP(3),

  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  "outletId"    TEXT NOT NULL UNIQUE,

  CONSTRAINT "Billing_outletId_fkey"
    FOREIGN KEY ("outletId") REFERENCES "Outlet"(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Billing_status_idx" ON "Billing"(status);


-- ---------- ApiKey ----------
CREATE TABLE IF NOT EXISTS "ApiKey" (
  id           TEXT PRIMARY KEY,
  "keyHash"    TEXT NOT NULL UNIQUE,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "isActive"   BOOLEAN NOT NULL DEFAULT TRUE,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  "userId"     TEXT NOT NULL,
  "outletId"   TEXT NOT NULL,

  CONSTRAINT "ApiKey_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "ApiKey_outletId_fkey"
    FOREIGN KEY ("outletId") REFERENCES "Outlet"(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx" ON "ApiKey"("userId");
CREATE INDEX IF NOT EXISTS "ApiKey_outletId_idx" ON "ApiKey"("outletId");
CREATE INDEX IF NOT EXISTS "ApiKey_expiresAt_idx" ON "ApiKey"("expiresAt");


-- ---------- AuditLog ----------
CREATE TABLE IF NOT EXISTS "AuditLog" (
  id          TEXT PRIMARY KEY,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  "entityId"  TEXT NOT NULL,
  details     TEXT,
  ip          TEXT,
  "userAgent" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  "userId"    TEXT NOT NULL,
  "outletId"  TEXT,
  "reviewId"  TEXT,

  CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "AuditLog_outletId_fkey"
    FOREIGN KEY ("outletId") REFERENCES "Outlet"(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT "AuditLog_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "Review"(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"(action);
CREATE INDEX IF NOT EXISTS "AuditLog_entity_idx" ON "AuditLog"(entity);
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");


-- ---------- SubscriptionAuditLog ----------
CREATE TABLE IF NOT EXISTS "SubscriptionAuditLog" (
  id         TEXT PRIMARY KEY,

  "outletId" TEXT NOT NULL,
  "adminId"  TEXT NOT NULL,

  action     TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  remarks    TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "SubscriptionAuditLog_outletId_fkey"
    FOREIGN KEY ("outletId") REFERENCES "Outlet"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "SubscriptionAuditLog_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "User"(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SubscriptionAuditLog_outletId_idx" ON "SubscriptionAuditLog"("outletId");
CREATE INDEX IF NOT EXISTS "SubscriptionAuditLog_adminId_idx" ON "SubscriptionAuditLog"("adminId");
CREATE INDEX IF NOT EXISTS "SubscriptionAuditLog_action_idx" ON "SubscriptionAuditLog"(action);
CREATE INDEX IF NOT EXISTS "SubscriptionAuditLog_createdAt_idx" ON "SubscriptionAuditLog"("createdAt");


-- ---------- IpAllowlist ----------
CREATE TABLE IF NOT EXISTS "IpAllowlist" (
  id          TEXT PRIMARY KEY,
  ip          TEXT NOT NULL UNIQUE,
  description TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT TRUE,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IpAllowlist_ip_idx" ON "IpAllowlist"(ip);
CREATE INDEX IF NOT EXISTS "IpAllowlist_isActive_idx" ON "IpAllowlist"("isActive");


-- ---------- Payment ----------
CREATE TABLE IF NOT EXISTS "Payment" (
  id                  TEXT PRIMARY KEY,
  "razorpayOrderId"    TEXT NOT NULL UNIQUE,
  "razorpayPaymentId"  TEXT UNIQUE,

  amount              INT NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'INR',
  status              "PaymentStatus" NOT NULL DEFAULT 'PENDING',

  "planType"           "SubscriptionPlan" NOT NULL,

  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  "userId"             TEXT NOT NULL,
  "outletId"           TEXT NOT NULL,
  "billingId"          TEXT,

  CONSTRAINT "Payment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "Payment_outletId_fkey"
    FOREIGN KEY ("outletId") REFERENCES "Outlet"(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "Payment_billingId_fkey"
    FOREIGN KEY ("billingId") REFERENCES "Billing"(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX IF NOT EXISTS "Payment_outletId_idx" ON "Payment"("outletId");
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"(status);
CREATE INDEX IF NOT EXISTS "Payment_razorpayOrderId_idx" ON "Payment"("razorpayOrderId");


-- ---------- RefreshToken ----------
CREATE TABLE IF NOT EXISTS "RefreshToken" (
  id         TEXT PRIMARY KEY,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "userId"    TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "RefreshToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");


-- ---------- ReviewWorkflow ----------
CREATE TABLE IF NOT EXISTS "ReviewWorkflow" (
  "reviewId"       TEXT PRIMARY KEY,
  "currentState"   "ReviewStatus" NOT NULL,
  "reminderCount"  INT NOT NULL DEFAULT 0,

  "lastActionAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "lastReminderAt" TIMESTAMP(3),
  "nextReminderAt" TIMESTAMP(3),

  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "ReviewWorkflow_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "Review"(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ReviewWorkflow_currentState_idx" ON "ReviewWorkflow"("currentState");
CREATE INDEX IF NOT EXISTS "ReviewWorkflow_nextReminderAt_idx" ON "ReviewWorkflow"("nextReminderAt");
