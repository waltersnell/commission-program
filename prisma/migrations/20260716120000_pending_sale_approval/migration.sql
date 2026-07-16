PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_MembershipSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "membershipSaleDate" DATETIME NOT NULL,
    "membershipTypeId" TEXT NOT NULL,
    "finalPrimaryCloserId" TEXT NOT NULL,
    "finalSupportCloserId" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
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

INSERT INTO "new_MembershipSale" (
    "id",
    "opportunityId",
    "locationId",
    "membershipSaleDate",
    "membershipTypeId",
    "finalPrimaryCloserId",
    "finalSupportCloserId",
    "approvalStatus",
    "isFirstVisitSale",
    "notes",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "opportunityId",
    "locationId",
    "membershipSaleDate",
    "membershipTypeId",
    "finalPrimaryCloserId",
    "finalSupportCloserId",
    CASE
      WHEN "approvalStatus" = 'APPROVED' THEN 'APPROVED'
      WHEN "approvalStatus" = 'REJECTED' THEN 'REJECTED'
      ELSE 'PENDING'
    END,
    "isFirstVisitSale",
    "notes",
    "createdAt",
    "updatedAt"
FROM "MembershipSale";

DROP TABLE "MembershipSale";
ALTER TABLE "new_MembershipSale" RENAME TO "MembershipSale";

CREATE UNIQUE INDEX "MembershipSale_opportunityId_key" ON "MembershipSale"("opportunityId");
CREATE INDEX "MembershipSale_membershipSaleDate_idx" ON "MembershipSale"("membershipSaleDate");
CREATE INDEX "MembershipSale_approvalStatus_idx" ON "MembershipSale"("approvalStatus");
CREATE INDEX "MembershipSale_isFirstVisitSale_idx" ON "MembershipSale"("isFirstVisitSale");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
