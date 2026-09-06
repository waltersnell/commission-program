ALTER TABLE "User" ADD COLUMN "staffId" TEXT REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "User"
SET "staffId" = (
  SELECT "Staff"."id"
  FROM "Staff"
  WHERE lower(trim("Staff"."displayName")) = lower(trim("User"."displayName"))
     OR lower(trim("Staff"."firstName")) = lower(trim("User"."displayName"))
     OR lower(trim("Staff"."displayName")) = lower(trim("User"."username"))
     OR lower(trim("Staff"."firstName")) = lower(trim("User"."username"))
  LIMIT 1
)
WHERE "staffId" IS NULL;

CREATE UNIQUE INDEX "User_staffId_key" ON "User"("staffId");
