import prisma from "../config/db.js";
import { sendSafeError } from "../middleware/error.middleware.js";

const LEADERSHIP_ROLES = new Set(["SUPERADMIN", "ADMIN"]);
const VALID_USER_ROLES = new Set(["SUPERADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "INTERN"]);

export async function getActivityLogs(req, res) {
  try {
    if (!LEADERSHIP_ROLES.has(req.user?.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 50;
    const offsetRaw = Number(req.query.offset);
    const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    const role = typeof req.query.role === "string" ? req.query.role.trim().toUpperCase() : "";
    const method = typeof req.query.method === "string" ? req.query.method.trim().toUpperCase() : "";
    const statusCodeRaw = typeof req.query.statusCode === "string" ? req.query.statusCode.trim() : "";
    const from = typeof req.query.from === "string" ? req.query.from.trim() : "";
    const to = typeof req.query.to === "string" ? req.query.to.trim() : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (role && !VALID_USER_ROLES.has(role)) {
      return res.status(400).json({ error: "Invalid role filter" });
    }
    if (method && !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return res.status(400).json({ error: "Invalid method filter" });
    }

    const statusCode = statusCodeRaw ? Number(statusCodeRaw) : null;
    if (statusCodeRaw && (!Number.isFinite(statusCode) || statusCode < 100 || statusCode > 599)) {
      return res.status(400).json({ error: "Invalid status code filter" });
    }

    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
      return res.status(400).json({ error: "Invalid date filter" });
    }

    const where = {
      ...(userId ? { userId } : {}),
      ...(role ? { userRole: role } : {}),
      ...(method ? { method } : {}),
      ...(statusCode ? { statusCode } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: "insensitive" } },
              { path: { contains: q, mode: "insensitive" } },
              { method: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return res.json({
      items,
      total,
      hasMore: offset + items.length < total,
      nextOffset: offset + items.length,
    });
  } catch (err) {
    const prismaCode = typeof err?.code === "string" ? err.code : "";
    if (prismaCode === "P2021") {
      return res.status(503).json({
        error: "Activity logs are not ready yet. Database migration is pending on server.",
      });
    }
    return sendSafeError(res, err, "Unable to fetch activity logs");
  }
}
