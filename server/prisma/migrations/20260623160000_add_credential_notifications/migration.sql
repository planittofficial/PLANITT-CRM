-- Extend NotificationType enum for credential expiry alerts
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CREDENTIAL_EXPIRING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CREDENTIAL_EXPIRED';

-- Notification preference toggle for credential alerts
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "credentialAlerts" BOOLEAN NOT NULL DEFAULT true;
