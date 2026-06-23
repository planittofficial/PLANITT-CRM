export function usageDisplayName(usage) {
  if (usage?.project?.name) return usage.project.name;
  if (usage?.projectName) return usage.projectName;
  return "Unnamed project";
}

export function normalizeEnvironment(value) {
  const env = String(value ?? "").trim();
  return env || null;
}

export function normalizeEnvKey(value) {
  const key = String(value ?? "").trim();
  return key || null;
}

export function usageLinkKey(usage) {
  const projectPart = usage.projectId ?? `name:${(usage.projectName ?? "").toLowerCase()}`;
  const env = normalizeEnvironment(usage.environment) ?? "";
  const key = normalizeEnvKey(usage.envKey) ?? "";
  return `${projectPart}|${env}|${key}`;
}
