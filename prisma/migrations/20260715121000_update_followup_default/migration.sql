PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_MembershipOpportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "firstVisitTherapistId" TEXT,
    "proposedPrimaryCloserId" TEXT NOT NULL,
    "proposedSupportCloserId" TEXT,
    "collectedBy" TEXT NOT NULL DEFAULT 'Primary Closer',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "interestLevel" TEXT NOT NULL DEFAULT 'None',
    "closureReason" TEXT,
    "closureNote" TEXT,
    "lastFollowUpDate" DATETIME,
    "nextFollowUpDate" DATETIME,
    "followUpOwnerId" TEXT,
    "followUpStatus" TEXT NOT NULL DEFAULT 'Follow Up Needed',
    "followUpNotes" TEXT,
    "intakeSubmittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MembershipOpportunity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipOpportunity_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipOpportunity_firstVisitTherapistId_fkey" FOREIGN KEY ("firstVisitTherapistId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MembershipOpportunity_proposedPrimaryCloserId_fkey" FOREIGN KEY ("proposedPrimaryCloserId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MembershipOpportunity_proposedSupportCloserId_fkey" FOREIGN KEY ("proposedSupportCloserId") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_MembershipOpportunity" (
    "id",
    "clientId",
    "locationId",
    "firstVisitTherapistId",
    "proposedPrimaryCloserId",
    "proposedSupportCloserId",
    "collectedBy",
    "status",
    "interestLevel",
    "closureReason",
    "closureNote",
    "lastFollowUpDate",
    "nextFollowUpDate",
    "followUpOwnerId",
    "followUpStatus",
    "followUpNotes",
    "intakeSubmittedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "clientId",
    "locationId",
    "firstVisitTherapistId",
    "proposedPrimaryCloserId",
    "proposedSupportCloserId",
    "collectedBy",
    "status",
    "interestLevel",
    "closureReason",
    "closureNote",
    "lastFollowUpDate",
    "nextFollowUpDate",
    "followUpOwnerId",
    COALESCE(NULLIF("followUpStatus", ''), 'Follow Up Needed'),
    "followUpNotes",
    "intakeSubmittedAt",
    "createdAt",
    "updatedAt"
FROM "MembershipOpportunity";

DROP TABLE "MembershipOpportunity";
ALTER TABLE "new_MembershipOpportunity" RENAME TO "MembershipOpportunity";

CREATE UNIQUE INDEX "MembershipOpportunity_clientId_key" ON "MembershipOpportunity"("clientId");
CREATE INDEX "MembershipOpportunity_status_idx" ON "MembershipOpportunity"("status");
CREATE INDEX "MembershipOpportunity_locationId_idx" ON "MembershipOpportunity"("locationId");
CREATE INDEX "MembershipOpportunity_firstVisitTherapistId_idx" ON "MembershipOpportunity"("firstVisitTherapistId");
CREATE INDEX "MembershipOpportunity_proposedPrimaryCloserId_idx" ON "MembershipOpportunity"("proposedPrimaryCloserId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
