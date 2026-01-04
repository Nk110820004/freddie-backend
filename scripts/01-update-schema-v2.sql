-- Adding missing fields and tables for review automation and manual queue
-- Based on shared requirements

-- Enum Updates (Cast existing if needed or add new values)
-- Prisma handle enums usually, but for raw SQL:
DO $$ BEGIN
    CREATE TYPE "BusinessCategory" AS ENUM ('HOTEL', 'RESTAURANT', 'GYM', 'CLINIC', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'PAID', 'PARTIAL', 'UNPAID', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ManualQueueStatus" AS ENUM ('PENDING', 'RESPONDED', 'ESCALATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update Outlet Table
ALTER TABLE "Outlet" 
ADD COLUMN IF NOT EXISTS "group_name" TEXT,
ADD COLUMN IF NOT EXISTS "primary_contact_name" TEXT,
ADD COLUMN IF NOT EXISTS "contact_email" TEXT,
ADD COLUMN IF NOT EXISTS "contact_phone" TEXT,
ADD COLUMN IF NOT EXISTS "category" "BusinessCategory" DEFAULT 'OTHER',
ADD COLUMN IF NOT EXISTS "subscription_status" "SubscriptionStatus" DEFAULT 'TRIAL',
ADD COLUMN IF NOT EXISTS "billing_status" "OutletStatus" DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS "api_status" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "onboarding_status" TEXT DEFAULT 'PENDING';

-- Update Review Table Statuses
-- Prisma ReviewStatus might need update, adding specific statuses
ALTER TABLE "Review" ALTER COLUMN "status" TYPE TEXT; -- Convert to text for more flexibility or update enum

-- Manual Review Queue
CREATE TABLE IF NOT EXISTS "ManualReviewQueue" (
  "id" TEXT PRIMARY KEY,
  "reviewId" TEXT NOT NULL REFERENCES "Review"("id") ON DELETE CASCADE,
  "outletId" TEXT NOT NULL REFERENCES "Outlet"("id") ON DELETE CASCADE,
  "assignedAdminId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "reminderCount" INTEGER DEFAULT 0,
  "nextReminderAt" TIMESTAMP,
  "status" "ManualQueueStatus" DEFAULT 'PENDING',
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription Audit Log
CREATE TABLE IF NOT EXISTS "SubscriptionAuditLog" (
  "id" TEXT PRIMARY KEY,
  "outletId" TEXT NOT NULL REFERENCES "Outlet"("id") ON DELETE CASCADE,
  "adminId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "action" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  "remarks" TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_manual_queue_status" ON "ManualReviewQueue"("status");
CREATE INDEX IF NOT EXISTS "idx_manual_queue_reminder" ON "ManualReviewQueue"("nextReminderAt");
