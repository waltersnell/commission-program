-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "MembershipType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "phoneDisplay" TEXT NOT NULL,
    "firstVisitDate" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MembershipOpportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "proposedPrimaryCloserId" TEXT NOT NULL,
    "proposedSupportCloserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closureReason" TEXT,
    "closureNote" TEXT,
    "lastFollowUpDate" DATETIME,
    "nextFollowUpDate" DATETIME,
    "followUpOwnerId" TEXT,
    "followUpStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "followUpNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembershipOpportunity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipOpportunity_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipOpportunity_proposedPrimaryCloserId_fkey" FOREIGN KEY ("proposedPrimaryCloserId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipOpportunity_proposedSupportCloserId_fkey" FOREIGN KEY ("proposedSupportCloserId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MembershipSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "membershipSaleDate" DATETIME NOT NULL,
    "membershipTypeId" TEXT NOT NULL,
    "finalPrimaryCloserId" TEXT NOT NULL,
    "finalSupportCloserId" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
    "isFirstVisitSale" BOOLEAN NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembershipSale_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "MembershipOpportunity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipSale_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipSale_membershipTypeId_fkey" FOREIGN KEY ("membershipTypeId") REFERENCES "MembershipType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipSale_finalPrimaryCloserId_fkey" FOREIGN KEY ("finalPrimaryCloserId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipSale_finalSupportCloserId_fkey" FOREIGN KEY ("finalSupportCloserId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleCredit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "creditBasisPoints" INTEGER NOT NULL,
    "creditUnits" DECIMAL NOT NULL,
    "firstVisitCreditUnits" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleCredit_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "MembershipSale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleCredit_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "followUpDate" DATETIME NOT NULL,
    "ownerId" TEXT,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowUp_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "MembershipOpportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommissionPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "finalizedAt" DATETIME,
    "reopenedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CommissionResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "fullSaleCount" INTEGER NOT NULL,
    "splitCreditUnits" DECIMAL NOT NULL,
    "totalCredits" DECIMAL NOT NULL,
    "firstVisitCredits" DECIMAL NOT NULL,
    "baseCommissionCents" INTEGER NOT NULL,
    "firstVisitBonusCents" INTEGER NOT NULL,
    "adjustmentsCents" INTEGER NOT NULL DEFAULT 0,
    "finalCommissionCents" INTEGER NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'FINAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommissionResult_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "CommissionPeriod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommissionResult_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommissionSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "editableBy" TEXT NOT NULL DEFAULT 'ADMINISTRATOR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actingUser" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipType_name_key" ON "MembershipType"("name");

-- CreateIndex
CREATE INDEX "Client_phoneNormalized_idx" ON "Client"("phoneNormalized");

-- CreateIndex
CREATE INDEX "Client_firstName_lastName_firstVisitDate_idx" ON "Client"("firstName", "lastName", "firstVisitDate");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipOpportunity_clientId_key" ON "MembershipOpportunity"("clientId");

-- CreateIndex
CREATE INDEX "MembershipOpportunity_status_idx" ON "MembershipOpportunity"("status");

-- CreateIndex
CREATE INDEX "MembershipOpportunity_locationId_idx" ON "MembershipOpportunity"("locationId");

-- CreateIndex
CREATE INDEX "MembershipOpportunity_proposedPrimaryCloserId_idx" ON "MembershipOpportunity"("proposedPrimaryCloserId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipSale_opportunityId_key" ON "MembershipSale"("opportunityId");

-- CreateIndex
CREATE INDEX "MembershipSale_membershipSaleDate_idx" ON "MembershipSale"("membershipSaleDate");

-- CreateIndex
CREATE INDEX "MembershipSale_approvalStatus_idx" ON "MembershipSale"("approvalStatus");

-- CreateIndex
CREATE INDEX "MembershipSale_isFirstVisitSale_idx" ON "MembershipSale"("isFirstVisitSale");

-- CreateIndex
CREATE INDEX "SaleCredit_staffId_idx" ON "SaleCredit"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleCredit_saleId_staffId_key" ON "SaleCredit"("saleId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionPeriod_month_key" ON "CommissionPeriod"("month");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionResult_periodId_staffId_key" ON "CommissionResult"("periodId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionSetting_key_key" ON "CommissionSetting"("key");

-- CreateIndex
CREATE INDEX "AuditLog_recordType_recordId_idx" ON "AuditLog"("recordType", "recordId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
