import { isBlockedCommand, normalizeCommandText } from "../config/command-blacklist.js";

const COMMAND_LIKE_KEYS = new Set([
  "command",
  "cmd",
  "shellcommand",
  "terminalcommand",
  "script",
  "scriptcommand",
  "exec",
  "execute",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function findBlockedCommandInPayload(value, parentKey = "") {
  if (typeof value === "string") {
    const normalizedKey = String(parentKey || "").toLowerCase().replace(/\s+/g, "");
    if (COMMAND_LIKE_KEYS.has(normalizedKey) && isBlockedCommand(value)) {
      return normalizeCommandText(value);
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const blocked = findBlockedCommandInPayload(item, parentKey);
      if (blocked) {
        return blocked;
      }
    }
    return null;
  }

  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      const blocked = findBlockedCommandInPayload(item, key);
      if (blocked) {
        return blocked;
      }
    }
  }

  return null;
}

export function commandBlacklistMiddleware(req, res, next) {
  const blockedCommand = findBlockedCommandInPayload(req.body);
  if (!blockedCommand) {
    return next();
  }

  return res.status(400).json({
    error: "Blocked dangerous command",
    detail: "This command is not allowed by security policy.",
  });
}

