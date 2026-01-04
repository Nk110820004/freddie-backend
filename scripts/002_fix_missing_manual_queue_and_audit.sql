-- Explicitly creating missing tables and fields as per requirements

-- Ensure business_category enum exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_category') THEN
        CREATE TYPE business_category AS ENUM ('HOTEL', 'RESTAURANT', 'GYM', 'CLINIC', 'OTHER');
    END IF;
END $$;

-- Manual Review Queue table for 1-3 star reviews
CREATE TABLE IF NOT EXISTS "ManualReviewQueue" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "assignedAdminId" TEXT,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "nextReminderAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualReviewQueue_pkey" PRIMARY KEY ("id")
);

-- Subscription Audit Log for tracking admin overrides
CREATE TABLE IF NOT EXISTS "SubscriptionAuditLog" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionAuditLog_pkey" PRIMARY KEY ("id")
);

-- Indexes for performance and constraints
CREATE UNIQUE INDEX IF NOT EXISTS "ManualReviewQueue_reviewId_key" ON "ManualReviewQueue"("reviewId");
CREATE INDEX IF NOT EXISTS "ManualReviewQueue_outletId_idx" ON "ManualReviewQueue"("outletId");
CREATE INDEX IF NOT EXISTS "ManualReviewQueue_status_idx" ON "ManualReviewQueue"("status");

-- Add constraints if not present
ALTER TABLE "ManualReviewQueue" ADD CONSTRAINT "ManualReviewQueue_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualReviewQueue" ADD CONSTRAINT "ManualReviewQueue_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
