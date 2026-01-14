-- Add googleConnected field to Outlet table
ALTER TABLE "Outlet" ADD COLUMN "googleConnected" BOOLEAN NOT NULL DEFAULT false;

-- Create GoogleConnectToken table
CREATE TABLE "GoogleConnectToken" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleConnectToken_pkey" PRIMARY KEY ("id")
);

-- Create GoogleIntegration table
CREATE TABLE "GoogleIntegration" (
    "id" TEXT NOT NULL,
    "outletId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleIntegration_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "GoogleConnectToken_token_key" ON "GoogleConnectToken"("token");
CREATE INDEX "GoogleConnectToken_outletId_idx" ON "GoogleConnectToken"("outletId");
CREATE INDEX "GoogleConnectToken_expiresAt_idx" ON "GoogleConnectToken"("expiresAt");
CREATE UNIQUE INDEX "GoogleIntegration_outletId_key" ON "GoogleIntegration"("outletId");
CREATE INDEX "GoogleIntegration_outletId_idx" ON "GoogleIntegration"("outletId");

-- Add foreign key constraints
ALTER TABLE "GoogleConnectToken" ADD CONSTRAINT "GoogleConnectToken_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleIntegration" ADD CONSTRAINT "GoogleIntegration_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "Outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;