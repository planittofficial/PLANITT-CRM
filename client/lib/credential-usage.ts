import type { Credential, CredentialUsage } from "@/types/crm";

export function usageDisplayName(usage: CredentialUsage) {
  if (usage.displayName) return usage.displayName;
  if (usage.project?.name) return usage.project.name;
  if (usage.projectName) return usage.projectName;
  return "Unnamed project";
}

export function credentialProjectNames(credential: Credential) {
  const names = (credential.usages ?? []).map(usageDisplayName);
  return Array.from(new Set(names));
}

export function statusLabel(status: Credential["status"], daysLeft: number | null) {
  if (status === "EXPIRING_SOON" && daysLeft !== null) return `Expiring in ${daysLeft}d`;
  if (status === "EXPIRED") return "Expired";
  if (status === "VALID") return "Valid";
  return "Unknown expiry";
}
