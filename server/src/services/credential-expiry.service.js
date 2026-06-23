import prisma from "../config/db.js";
import { computeDerivedExpiry, computeCredentialStatus } from "../utils/credential-expiry.js";
import {
  createNotification,
  getNotificationRecipientsByRoles,
  isNotificationTypeEnabled,
} from "./notification.service.js";

const LEADERSHIP_ROLES = ["SUPERADMIN", "ADMIN", "MANAGER"];
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function formatUsageSummary(usages = []) {
  if (!usages.length) {
    return "No project usage links recorded yet — add them on the Credentials page.";
  }

  return usages
    .map((usage) => {
      const env = usage.environment ? ` (${usage.environment})` : "";
      const key = usage.envKey ? ` — ${usage.envKey}` : "";
      return `${usage.project.name}${env}${key}`;
    })
    .join("; ");
}

async function wasAlertSentRecently(credentialId, alertKind) {
  const cutoff = new Date(Date.now() - ALERT_COOLDOWN_MS);
  const existing = await prisma.notification.findFirst({
    where: {
      groupKey: `credential:${credentialId}:${alertKind}`,
      createdAt: { gte: cutoff },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function collectRecipientIds(credential) {
  const recipientIds = new Set(await getNotificationRecipientsByRoles(LEADERSHIP_ROLES));

  const projectIds = Array.from(new Set((credential.usages ?? []).map((u) => u.projectId).filter(Boolean)));
  if (!projectIds.length) {
    return Array.from(recipientIds);
  }

  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: {
      ownerId: true,
      members: { select: { userId: true } },
    },
  });

  for (const project of projects) {
    if (project.ownerId) recipientIds.add(project.ownerId);
    for (const member of project.members) {
      recipientIds.add(member.userId);
    }
  }

  return Array.from(recipientIds);
}

async function notifyRecipients({
  credential,
  recipientIds,
  type,
  title,
  message,
  priority,
  alertKind,
  projectId = null,
}) {
  let sent = 0;

  for (const userId of recipientIds) {
    const enabled = await isNotificationTypeEnabled(userId, type);
    if (!enabled) continue;

    await createNotification({
      userId,
      type,
      title,
      message,
      href: "/credentials",
      priority,
      projectId,
      groupKey: `credential:${credential.id}:${alertKind}`,
    });
    sent += 1;
  }

  return sent;
}

async function processCredentialAlert(credential) {
  const derivedExpiresAt = computeDerivedExpiry(credential);
  const { status, daysLeft } = computeCredentialStatus(derivedExpiresAt);

  if (status !== "EXPIRING_SOON" && status !== "EXPIRED") {
    return { credentialId: credential.id, skipped: true, reason: status };
  }

  const alertKind = status === "EXPIRED" ? "expired" : "expiring";
  if (await wasAlertSentRecently(credential.id, alertKind)) {
    return { credentialId: credential.id, skipped: true, reason: "cooldown" };
  }

  const usageSummary = formatUsageSummary(credential.usages);
  const envKey = credential.envKey ? ` (${credential.envKey})` : "";
  const expiryLabel = derivedExpiresAt
    ? new Date(derivedExpiresAt).toLocaleDateString()
    : "unknown date";

  const recipientIds = await collectRecipientIds(credential);
  if (!recipientIds.length) {
    return { credentialId: credential.id, skipped: true, reason: "no_recipients" };
  }

  const primaryProjectId = credential.usages?.[0]?.projectId ?? null;

  if (status === "EXPIRED") {
    const sent = await notifyRecipients({
      credential,
      recipientIds,
      type: "CREDENTIAL_EXPIRED",
      title: `Credential expired: ${credential.name}`,
      message: `${credential.name}${envKey} expired on ${expiryLabel}. Update this key in: ${usageSummary}`,
      priority: "URGENT",
      alertKind,
      projectId: primaryProjectId,
    });
    return { credentialId: credential.id, status, sent };
  }

  const sent = await notifyRecipients({
    credential,
    recipientIds,
    type: "CREDENTIAL_EXPIRING",
    title: `Credential expiring soon: ${credential.name}`,
    message: `${credential.name}${envKey} expires in ${daysLeft} day(s) on ${expiryLabel}. Update in: ${usageSummary}`,
    priority: daysLeft <= 7 ? "HIGH" : "MEDIUM",
    alertKind,
    projectId: primaryProjectId,
  });
  return { credentialId: credential.id, status, sent };
}

export async function runCredentialExpiryChecks() {
  const credentials = await prisma.credential.findMany({
    include: {
      usages: {
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  const results = [];
  for (const credential of credentials) {
    try {
      results.push(await processCredentialAlert(credential));
    } catch (error) {
      console.error(`Credential expiry check failed for ${credential.id}:`, error);
      results.push({ credentialId: credential.id, error: true });
    }
  }

  const notified = results.filter((r) => typeof r.sent === "number" && r.sent > 0);
  if (notified.length) {
    console.log(`Credential expiry checks sent ${notified.reduce((s, r) => s + r.sent, 0)} notification(s).`);
  }

  return results;
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export function startCredentialExpiryScheduler() {
  const run = () => {
    void runCredentialExpiryChecks().catch((error) => {
      console.error("Credential expiry scheduler run failed:", error);
    });
  };

  // Initial run shortly after boot so alerts appear without waiting for the interval.
  setTimeout(run, 15_000);
  setInterval(run, SIX_HOURS_MS);
}
