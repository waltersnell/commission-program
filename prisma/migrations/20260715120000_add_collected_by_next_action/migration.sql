ALTER TABLE "MembershipOpportunity" ADD COLUMN "collectedBy" TEXT NOT NULL DEFAULT 'Primary Closer';
ALTER TABLE "MembershipOpportunity" ADD COLUMN "intakeSubmittedAt" DATETIME;

UPDATE "MembershipOpportunity"
SET "intakeSubmittedAt" = "createdAt"
WHERE "intakeSubmittedAt" IS NULL;

UPDATE "MembershipOpportunity"
SET "followUpStatus" = 'Follow Up Needed'
WHERE "followUpStatus" IS NULL
   OR "followUpStatus" = ''
   OR "followUpStatus" = 'NOT_CONTACTED'
   OR "followUpStatus" = 'FOLLOW_UP_NEEDED';
