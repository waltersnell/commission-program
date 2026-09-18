ALTER TABLE "MembershipOpportunity" ADD COLUMN "statusSinceAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MembershipOpportunity" ADD COLUMN "statusDowngradeAt" DATETIME;
ALTER TABLE "MembershipOpportunity" ADD COLUMN "statusSource" TEXT NOT NULL DEFAULT 'MANUAL';

UPDATE "MembershipOpportunity"
SET "statusSinceAt" = "createdAt",
    "statusDowngradeAt" = CASE
      WHEN "interestLevel" IN ('Hot', 'Warm') THEN datetime("createdAt", '+30 days')
      WHEN "interestLevel" = 'Cold' THEN datetime("createdAt", '+360 days')
      ELSE NULL
    END;

ALTER TABLE "FollowUp" ADD COLUMN "crmStepId" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "stepLabelSnapshot" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "messageSnapshot" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "outcome" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "completedBy" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "statusBefore" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "statusAfter" TEXT;

ALTER TABLE "CrmStepTemplate" ADD COLUMN "communicationType" TEXT NOT NULL DEFAULT 'SMS';
ALTER TABLE "CrmStepTemplate" ADD COLUMN "delayDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrmStepTemplate" ADD COLUMN "applicableStatuses" TEXT NOT NULL DEFAULT 'Hot,Warm,Cold';
ALTER TABLE "CrmStepTemplate" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CrmStepTemplate" ADD COLUMN "resultingStatus" TEXT;

CREATE TABLE "OpportunityStatusHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "previousStatus" TEXT NOT NULL,
  "newStatus" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "changedBy" TEXT,
  "notes" TEXT,
  "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpportunityStatusHistory_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "MembershipOpportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OpportunityStatusHistory_opportunityId_changedAt_idx" ON "OpportunityStatusHistory"("opportunityId", "changedAt");

CREATE TABLE "CrmStatusSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "status" TEXT NOT NULL,
  "durationDays" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "CrmStatusSetting_status_key" ON "CrmStatusSetting"("status");

INSERT INTO "CrmStatusSetting" ("id", "status", "durationDays", "createdAt", "updatedAt") VALUES
  ('crm_status_hot', 'Hot', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('crm_status_warm', 'Warm', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('crm_status_cold', 'Cold', 360, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
