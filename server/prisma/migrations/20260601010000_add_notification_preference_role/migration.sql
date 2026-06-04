-- Add role-aware notification preferences without changing existing records.
ALTER TABLE "NotificationPreference" ADD COLUMN "role" "UserRole";

UPDATE "NotificationPreference" AS pref
SET "role" = "User"."role"
FROM "User"
WHERE pref."userId" = "User"."id";

CREATE INDEX "NotificationPreference_role_idx" ON "NotificationPreference"("role");
