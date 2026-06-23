-- CreateTable
CREATE TABLE "Credential" (
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

-- CreateTable
CREATE TABLE "CredentialUsage" (
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

-- CreateIndex
CREATE INDEX "Credential_expiresAt_idx" ON "Credential"("expiresAt");

-- CreateIndex
CREATE INDEX "Credential_createdAt_idx" ON "Credential"("createdAt");

-- CreateIndex
CREATE INDEX "CredentialUsage_credentialId_idx" ON "CredentialUsage"("credentialId");

-- CreateIndex
CREATE INDEX "CredentialUsage_projectId_idx" ON "CredentialUsage"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CredentialUsage_credentialId_projectId_environment_envKey_key"
ON "CredentialUsage"("credentialId", "projectId", "environment", "envKey");

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialUsage" ADD CONSTRAINT "CredentialUsage_credentialId_fkey"
FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialUsage" ADD CONSTRAINT "CredentialUsage_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

