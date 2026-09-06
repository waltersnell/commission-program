ALTER TABLE "MembershipType" ADD COLUMN "commissionKind" TEXT NOT NULL DEFAULT 'STANDARD';

ALTER TABLE "SaleCredit" ADD COLUMN "payoutBasisPoints" INTEGER NOT NULL DEFAULT 10000;
ALTER TABLE "SaleCredit" ADD COLUMN "fixedCommissionCents" INTEGER NOT NULL DEFAULT 0;
UPDATE "SaleCredit" SET "payoutBasisPoints" = "creditBasisPoints";

ALTER TABLE "CommissionResult" ADD COLUMN "membershipSpiffCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CommissionResult" ADD COLUMN "specialSpiffCents" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "SpecialSpiff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "functionDescription" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "endDate" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SpecialSpiffAward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "specialSpiffId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "activityDate" DATETIME NOT NULL,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "spiffNameSnapshot" TEXT NOT NULL,
    "functionDescriptionSnapshot" TEXT NOT NULL,
    "amountCentsSnapshot" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SpecialSpiffAward_specialSpiffId_fkey" FOREIGN KEY ("specialSpiffId") REFERENCES "SpecialSpiff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SpecialSpiffAward_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SpecialSpiffAward_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SpecialSpiffAward_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SpecialSpiff_name_key" ON "SpecialSpiff"("name");
CREATE UNIQUE INDEX "SpecialSpiffAward_specialSpiffId_clientId_key" ON "SpecialSpiffAward"("specialSpiffId", "clientId");
CREATE INDEX "SpecialSpiffAward_activityDate_idx" ON "SpecialSpiffAward"("activityDate");
CREATE INDEX "SpecialSpiffAward_approvalStatus_idx" ON "SpecialSpiffAward"("approvalStatus");
CREATE INDEX "SpecialSpiffAward_staffId_idx" ON "SpecialSpiffAward"("staffId");
CREATE INDEX "SpecialSpiffAward_clientId_idx" ON "SpecialSpiffAward"("clientId");

INSERT OR IGNORE INTO "MembershipType" ("id", "name", "active", "commissionKind")
VALUES ('system-family-upgrade-spiff', 'Family Upgrade Spiff', true, 'FAMILY_UPGRADE_SPIFF');
UPDATE "MembershipType"
SET "commissionKind" = 'FAMILY_UPGRADE_SPIFF'
WHERE "name" = 'Family Upgrade Spiff';

INSERT OR IGNORE INTO "CommissionSetting" ("id", "key", "label", "value", "editableBy", "createdAt", "updatedAt")
VALUES ('system-family-upgrade-spiff-amount', 'familyUpgradeSpiffCents', 'Family Upgrade Spiff amount', '1000', 'ADMINISTRATOR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
