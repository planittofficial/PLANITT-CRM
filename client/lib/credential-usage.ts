import type { Credential, CredentialUsage } from "@/types/crm";

const ENV_VAR_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

export function looksLikeSecret(value: string | null | undefined) {
  if (!value?.trim()) return false;
  const trimmed = value.trim();
  if (ENV_VAR_NAME_PATTERN.test(trimmed)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return true;
  if (trimmed.includes("@") && trimmed.length > 24) return true;
  if (trimmed.length > 56) return true;
  if (/^sk-[A-Za-z0-9]{16,}$/i.test(trimmed)) return true;
  return false;
}

export function suggestEnvKeyName(name: string) {
  const normalized = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) return "ENV_VARIABLE";
  if (normalized.endsWith("_URL") || normalized.endsWith("_URI") || normalized.endsWith("_KEY")) {
    return normalized;
  }
  if (normalized.includes("URL") || normalized.includes("URI")) return normalized;
  if (normalized.includes("KEY") || normalized.includes("TOKEN") || normalized.includes("SECRET")) {
    return normalized;
  }
  return `${normalized}_URL`;
}

export type EnvKeyDisplay = {
  label: string;
  isSecret: boolean;
  hint?: string;
};

export function resolveEnvKeyDisplay(
  value: string | null | undefined,
  credentialName?: string | null
): EnvKeyDisplay {
  if (!value?.trim()) {
    return {
      label: suggestEnvKeyName(credentialName ?? "ENV_VARIABLE"),
      isSecret: false,
      hint: "Env variable name not set",
    };
  }

  const trimmed = value.trim();
  if (!looksLikeSecret(trimmed)) {
    return { label: trimmed, isSecret: false };
  }

  return {
    label: suggestEnvKeyName(credentialName ?? "CREDENTIAL"),
    isSecret: true,
    hint: "Connection string hidden — store only the env variable name here",
  };
}

export function searchableCredentialText(credential: Credential) {
  const envText = resolveEnvKeyDisplay(credential.envKey, credential.name).label;
  return [credential.name, credential.provider, envText, ...credentialProjectNames(credential)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

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

export type CredentialVisualStatus = Credential["status"];

export function statusTone(status: CredentialVisualStatus) {
  if (status === "EXPIRED") {
    return {
      stroke: "#ef4444",
      fill: "color-mix(in srgb, #ef4444 18%, var(--surface))",
      glow: "rgba(239, 68, 68, 0.55)",
      text: "var(--danger)",
      pulse: true,
    };
  }
  if (status === "EXPIRING_SOON") {
    return {
      stroke: "#f59e0b",
      fill: "color-mix(in srgb, #f59e0b 16%, var(--surface))",
      glow: "rgba(245, 158, 11, 0.45)",
      text: "#b45309",
      pulse: true,
    };
  }
  if (status === "VALID") {
    return {
      stroke: "#10b981",
      fill: "color-mix(in srgb, #10b981 12%, var(--surface))",
      glow: "rgba(16, 185, 129, 0.28)",
      text: "var(--success)",
      pulse: false,
    };
  }
  return {
    stroke: "var(--border)",
    fill: "var(--surface-soft)",
    glow: "rgba(148, 163, 184, 0.2)",
    text: "var(--text-soft)",
    pulse: false,
  };
}
