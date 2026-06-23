-- Allow custom project names and optional CRM project link
ALTER TABLE "CredentialUsage" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "CredentialUsage" ADD COLUMN IF NOT EXISTS "projectName" TEXT;

DROP INDEX IF EXISTS "CredentialUsage_credentialId_projectId_environment_envKey_key";

CREATE INDEX IF NOT EXISTS "CredentialUsage_projectName_idx" ON "CredentialUsage"("projectName");
