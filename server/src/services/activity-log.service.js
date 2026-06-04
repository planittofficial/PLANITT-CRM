import prisma from "../config/db.js";

const SKIPPED_PREFIXES = ["/api/health"];
const SKIPPED_PATHS = new Set(["/api/auth/me"]);

function shouldSkipPath(pathname) {
  if (!pathname) {
    return true;
  }
  if (SKIPPED_PATHS.has(pathname)) {
    return true;
  }
  return SKIPPED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function buildActionLabel(method, path) {
  const cleanPath = String(path || "")
    .replace(/^\/api\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\//g, " ")
    .replace(/[:]/g, " ")
    .trim();
  return `${String(method || "GET").toUpperCase()} ${cleanPath || "unknown"}`.trim();
}

export async function writeActivityLog({
  userId,
  userRole,
  method,
  path,
  statusCode,
  ipAddress,
  userAgent,
  requestId,
  metadata,
}) {
  if (!userId || !userRole) {
    return;
  }
  if (shouldSkipPath(path)) {
    return;
  }

  try {
    await prisma.activityLog.create({
      data: {
        userId,
        userRole,
        method: String(method || "").toUpperCase(),
        path: String(path || ""),
        statusCode: Number(statusCode) || 0,
        action: buildActionLabel(method, path),
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        requestId: requestId || null,
        metadataJson: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch {
    // Avoid breaking request flow if activity logging fails.
  }
}

