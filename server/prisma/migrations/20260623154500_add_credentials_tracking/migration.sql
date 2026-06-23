-- Idempotent credentials tables (safe if schema was previously synced via db push)

CREATE TABLE IF NOT EXISTS "Credential" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "envKey" TEXT,
    "validityDays" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CredentialUsage" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environment" TEXT,
    "envKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CredentialUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Credential_expiresAt_idx" ON "Credential"("expiresAt");
CREATE INDEX IF NOT EXISTS "Credential_createdAt_idx" ON "Credential"("createdAt");
CREATE INDEX IF NOT EXISTS "CredentialUsage_credentialId_idx" ON "CredentialUsage"("credentialId");
CREATE INDEX IF NOT EXISTS "CredentialUsage_projectId_idx" ON "CredentialUsage"("projectId");

CREATE UNIQUE INDEX IF NOT EXISTS "CredentialUsage_credentialId_projectId_environment_envKey_key"
ON "CredentialUsage"("credentialId", "projectId", "environment", "envKey");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Credential_createdById_fkey') THEN
    ALTER TABLE "Credential" ADD CONSTRAINT "Credential_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CredentialUsage_credentialId_fkey') THEN
    ALTER TABLE "CredentialUsage" ADD CONSTRAINT "CredentialUsage_credentialId_fkey"
    FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CredentialUsage_projectId_fkey') THEN
    ALTER TABLE "CredentialUsage" ADD CONSTRAINT "CredentialUsage_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
