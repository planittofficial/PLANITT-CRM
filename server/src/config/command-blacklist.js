/**
 * Central denylist for destructive/sensitive shell commands.
 * These patterns are matched case-insensitively on normalized command text.
 */
export const BLOCKED_COMMAND_PATTERNS = [
  // Prisma and DB destructive operations
  /(^|\s)npx\s+prisma\s+migrate\s+reset(\s|$)/i,
  /(^|\s)prisma\s+migrate\s+reset(\s|$)/i,
  /(^|\s)npx\s+prisma\s+db\s+push\s+--force-reset(\s|$)/i,
  /(^|\s)prisma\s+db\s+push\s+--force-reset(\s|$)/i,
  /(^|\s)npx\s+prisma\s+db\s+drop(\s|$)/i,
  /(^|\s)prisma\s+db\s+drop(\s|$)/i,
  /(^|\s)drop\s+database(\s|$)/i,
  /(^|\s)truncate\s+table(\s|$)/i,

  // File-system destructive commands
  /(^|\s)rm\s+-rf(\s|$)/i,
  /(^|\s)rm\s+-fr(\s|$)/i,
  /(^|\s)del\s+\/f\s+\/s\s+\/q(\s|$)/i,
  /(^|\s)rmdir\s+\/s\s+\/q(\s|$)/i,
  /(^|\s)format\s+[a-z]:/i,

  // Git destructive commands
  /(^|\s)git\s+reset\s+--hard(\s|$)/i,
  /(^|\s)git\s+clean\s+-fdx(\s|$)/i,
  /(^|\s)git\s+checkout\s+--(\s|$)/i,
  /(^|\s)git\s+push\s+--force(\s|$)/i,

  // Container/system destructive commands
  /(^|\s)docker\s+system\s+prune\s+-a(\s|$)/i,
  /(^|\s)docker\s+volume\s+prune(\s|$)/i,
  /(^|\s)shutdown(\s|$)/i,
  /(^|\s)reboot(\s|$)/i,
  /(^|\s)halt(\s|$)/i,
];

export function normalizeCommandText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isBlockedCommand(value) {
  const normalized = normalizeCommandText(value);
  if (!normalized) {
    return false;
  }
  return BLOCKED_COMMAND_PATTERNS.some((pattern) => pattern.test(normalized));
}

