import bcrypt from "bcrypt";
import prisma from "../config/db.js";
import { emitCRMEvent } from "../socket.js";
import { sendSafeError } from "../middleware/error.middleware.js";

const USER_ALLOWED_ROLES = ["SUPERADMIN", "EMPLOYEE", "INTERN", "ADMIN", "MANAGER"];
const BULK_ALLOWED_ROLES = new Set(["EMPLOYEE", "INTERN"]);

function toPublicUserSelect() {
  return {
    id: true,
    name: true,
    email: true,
    role: true,
    designation: true,
    departmentId: true,
    department: {
      select: {
        id: true,
        name: true,
        code: true,
      },
    },
    managerId: true,
    manager: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    },
    createdAt: true,
  };
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLastNDays(dayCount) {
  const days = [];
  const now = new Date();
  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(now.getDate() - offset);
    days.push(date);
  }
  return days;
}

function toShortLabel(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getDurationHours(checkIn, checkOut) {
  const end = checkOut ? new Date(checkOut) : new Date();
  const start = new Date(checkIn);
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  return Number((diffMs / (1000 * 60 * 60)).toFixed(2));
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"(.*)"$/, "$1").trim());
}

function parseCsv(content) {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^\uFEFF/, "");
  const rows = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];

    if (char === '"') {
      if (inQuotes && normalized[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "\n" && !inQuotes) {
      if (current.trim()) {
        rows.push(parseCsvLine(current));
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    rows.push(parseCsvLine(current));
  }

  return rows;
}

async function resolveDepartmentId(departmentValue) {
  const candidate = String(departmentValue || "").trim();
  if (!candidate) {
    return null;
  }

  const department = await prisma.department.findFirst({
    where: {
      OR: [{ id: candidate }, { code: candidate }, { name: candidate }],
    },
    select: { id: true },
  });

  if (!department) {
    throw new Error(`Department "${candidate}" was not found`);
  }

  return department.id;
}

async function resolveManagerId(managerValue) {
  const candidate = String(managerValue || "").trim();
  if (!candidate) {
    return null;
  }

  const manager = await prisma.user.findFirst({
    where: {
      OR: [{ id: candidate }, { email: candidate }],
    },
    select: { id: true, role: true },
  });

  if (!manager || !["SUPERADMIN", "ADMIN", "MANAGER"].includes(manager.role)) {
    throw new Error(`Manager "${candidate}" is invalid`);
  }

  return manager.id;
}

async function createUserRecord(input, actorRole, actorUserId) {
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "").trim();
  const role = String(input.role || "EMPLOYEE").trim().toUpperCase();
  const designation = typeof input.designation === "string" ? input.designation.trim() : "";

  if (!name || !email || !password) {
    throw new Error("Name, email, and password are required");
  }

  if (!USER_ALLOWED_ROLES.includes(role)) {
    throw new Error("Invalid role");
  }

  if (actorRole !== "SUPERADMIN" && role === "SUPERADMIN") {
    throw new Error("Only the CEO can create another superadmin");
  }

  if (actorRole === "MANAGER" && !["EMPLOYEE", "INTERN"].includes(role)) {
    throw new Error("Managers may only create employees or interns");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error("User already exists");
  }

  const departmentId = await resolveDepartmentId(input.departmentId ?? input.department);
  let managerId = null;
  if (actorRole === "MANAGER") {
    managerId = actorUserId;
  } else {
    managerId = await resolveManagerId(input.managerId ?? input.managerEmail);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,
      designation,
      ...(departmentId ? { departmentId } : {}),
      ...(managerId ? { managerId } : {}),
      createdById: actorUserId,
    },
    select: toPublicUserSelect(),
  });
}

function buildWorkingHoursTrend(records, days) {
  const map = new Map();
  for (const day of days) {
    map.set(toDateKey(day), { totalHours: 0, count: 0 });
  }

  for (const record of records) {
    const key = toDateKey(new Date(record.date));
    if (!map.has(key)) {
      continue;
    }
    const bucket = map.get(key);
    bucket.totalHours += getDurationHours(record.checkIn, record.checkOut);
    bucket.count += 1;
  }

  return days.map((day) => {
    const key = toDateKey(day);
    const bucket = map.get(key);
    const hours = bucket.count ? Number((bucket.totalHours / bucket.count).toFixed(2)) : 0;
    return {
      date: key,
      label: toShortLabel(day),
      hours,
    };
  });
}

function buildTaskProgressTrend(tasks, days) {
  const map = new Map();
  for (const day of days) {
    map.set(toDateKey(day), { created: 0, completed: 0, progressSum: 0, progressCount: 0 });
  }

  for (const task of tasks) {
    const createdKey = toDateKey(new Date(task.createdAt));
    if (map.has(createdKey)) {
      map.get(createdKey).created += 1;
    }

    const updatedKey = toDateKey(new Date(task.updatedAt));
    if (map.has(updatedKey)) {
      const updatedBucket = map.get(updatedKey);
      updatedBucket.progressSum += task.progress;
      updatedBucket.progressCount += 1;
      if (task.status === "DONE") {
        updatedBucket.completed += 1;
      }
    }
  }

  return days.map((day) => {
    const key = toDateKey(day);
    const bucket = map.get(key);
    return {
      date: key,
      label: toShortLabel(day),
      created: bucket.created,
      completed: bucket.completed,
      avgProgress: bucket.progressCount
        ? Math.round(bucket.progressSum / bucket.progressCount)
        : 0,
    };
  });
}

function buildAttendanceHeatmap(records, days) {
  const map = new Map();
  for (const day of days) {
    map.set(toDateKey(day), { count: 0, hours: 0 });
  }

  for (const record of records) {
    const key = toDateKey(new Date(record.date));
    if (!map.has(key)) {
      continue;
    }
    const bucket = map.get(key);
    bucket.count += 1;
    bucket.hours += getDurationHours(record.checkIn, record.checkOut);
  }

  return days.map((day) => {
    const key = toDateKey(day);
    const bucket = map.get(key);
    return {
      date: key,
      label: toShortLabel(day),
      value: Number(bucket.hours.toFixed(1)),
      intensity: Math.min(100, Math.round((bucket.hours / 10) * 100)),
    };
  });
}

function buildScopedUserWhere(req) {
  const isSuperView = req.user.role === "SUPERADMIN" || req.user.role === "ADMIN";
  if (isSuperView) {
    return {};
  }
  if (req.user.role === "MANAGER") {
    return {
      OR: [{ managerId: req.user.userId }, { id: req.user.userId }],
    };
  }
  return {};
}

function parseRolesFilter(query) {
  const raw = String(query.roles ?? "").trim();
  if (!raw) {
    return null;
  }
  const roles = [...new Set(raw.split(",").map((role) => role.trim().toUpperCase()))].filter((role) =>
    USER_ALLOWED_ROLES.includes(role)
  );
  return roles.length ? roles : null;
}

function parseUserSearchQuery(query) {
  return String(query.q ?? query.search ?? "").trim();
}

function andWhereParts(...parts) {
  const filtered = parts.filter((part) => part && typeof part === "object" && Object.keys(part).length);
  if (!filtered.length) {
    return {};
  }
  if (filtered.length === 1) {
    return filtered[0];
  }
  return { AND: filtered };
}

function buildUserListWhere(req, { applySearch = true } = {}) {
  const scoped = buildScopedUserWhere(req);
  const roles = parseRolesFilter(req.query);
  const q = applySearch ? parseUserSearchQuery(req.query) : "";

  const searchClause = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { designation: { contains: q, mode: "insensitive" } },
          { department: { name: { contains: q, mode: "insensitive" } } },
          ...(USER_ALLOWED_ROLES.includes(q.toUpperCase()) ? [{ role: q.toUpperCase() }] : []),
        ],
      }
    : null;

  const roleClause = roles ? { role: { in: roles } } : null;

  return andWhereParts(scoped, searchClause, roleClause);
}

export async function getUserDirectoryStats(req, res) {
  try {
    const where = buildUserListWhere(req, { applySearch: false });
    const [total, employees, interns, leadership, withDepartment] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.count({ where: andWhereParts(where, { role: "EMPLOYEE" }) }),
      prisma.user.count({ where: andWhereParts(where, { role: "INTERN" }) }),
      prisma.user.count({
        where: andWhereParts(where, { role: { in: ["SUPERADMIN", "ADMIN", "MANAGER"] } } ),
      }),
      prisma.user.count({ where: andWhereParts(where, { departmentId: { not: null } }) }),
    ]);
    const departmentCoverage = total ? Math.round((withDepartment / total) * 100) : 0;
    return res.json({
      total,
      employees,
      interns,
      leadership,
      departmentCoverage,
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch directory stats");
  }
}

export async function getUsers(_req, res) {
  try {
    const where = buildUserListWhere(_req, { applySearch: true });

    const paginate = String(_req.query.paginate || "").toLowerCase() === "true";
    const limitRaw = Number(_req.query.limit);
    const offsetRaw = Number(_req.query.offset);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 25;
    const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;

    if (!paginate) {
      const users = await prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: toPublicUserSelect(),
      });
      return res.json(users);
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: toPublicUserSelect(),
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({
      items,
      total,
      hasMore: offset + items.length < total,
      nextOffset: offset + items.length,
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch users");
  }
}

export async function createUser(req, res) {
  try {
    const user = await createUserRecord(req.body, req.user.role, req.user.userId);

    emitCRMEvent("org:updated", {
      type: "user_created",
      userId: user.id,
      role: user.role,
    });

    return res.status(201).json(user);
  } catch (err) {
    return sendSafeError(res, err, "Unable to create user");
  }
}

export async function bulkCreateUsers(req, res) {
  try {
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: "Upload a CSV file to continue" });
    }

    const rows = parseCsv(req.file.buffer.toString("utf-8"));
    if (!rows.length) {
      return res.status(400).json({ error: "CSV file is empty" });
    }

    const [headerRow, ...dataRows] = rows;
    const headers = headerRow.map((header) => header.trim().toLowerCase());
    const requiredHeaders = ["name", "email", "password"];
    const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

    if (missingHeaders.length) {
      return res.status(400).json({
        error: `CSV is missing required columns: ${missingHeaders.join(", ")}`,
      });
    }

    const createdUsers = [];
    const errors = [];

    for (let index = 0; index < dataRows.length; index += 1) {
      const row = dataRows[index];
      if (!row.some((cell) => String(cell || "").trim())) {
        continue;
      }

      const payload = headers.reduce((acc, header, headerIndex) => {
        acc[header] = row[headerIndex] ?? "";
        return acc;
      }, {});

      const normalizedRole = String(payload.role || "EMPLOYEE").trim().toUpperCase();
      if (!BULK_ALLOWED_ROLES.has(normalizedRole)) {
        errors.push({
          row: index + 2,
          email: String(payload.email || "").trim() || null,
          message: 'Role must be either "EMPLOYEE" or "INTERN" for bulk upload',
        });
        continue;
      }

      try {
        const user = await createUserRecord(
          { ...payload, role: normalizedRole },
          req.user.role,
          req.user.userId
        );
        createdUsers.push(user);
      } catch (error) {
        errors.push({
          row: index + 2,
          email: String(payload.email || "").trim() || null,
          message: error instanceof Error ? error.message : "Unable to create user",
        });
      }
    }

    if (createdUsers.length) {
      emitCRMEvent("org:updated", {
        type: "users_bulk_created",
        count: createdUsers.length,
      });
    }

    return res.status(createdUsers.length ? 201 : 200).json({
      createdCount: createdUsers.length,
      failedCount: errors.length,
      createdUsers,
      errors,
      expectedColumns: [
        "name",
        "email",
        "password",
        "role",
        "designation",
        "department",
        "managerEmail",
      ],
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to bulk upload users");
  }
}

export async function updateUserAssignment(req, res) {
  try {
    const { role, departmentId, managerId, designation } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        role: true,
        managerId: true,
      },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (req.user.role === "MANAGER") {
      if (existingUser.managerId !== req.user.userId) {
        return res.status(403).json({ error: "You can only update direct reports on your team." });
      }
      if (typeof role === "string" && role.trim() && !["EMPLOYEE", "INTERN"].includes(role.trim())) {
        return res.status(403).json({ error: "Managers cannot assign this role." });
      }
      if (Object.prototype.hasOwnProperty.call(req.body, "managerId")) {
        const rawMgr = managerId;
        const nextManagerId = typeof rawMgr === "string" && rawMgr.trim() ? rawMgr.trim() : null;
        if (nextManagerId && nextManagerId !== req.user.userId) {
          return res.status(400).json({ error: "Team members must report to you as their manager." });
        }
      }
    }

    if (existingUser.role === "SUPERADMIN" && req.user.role !== "SUPERADMIN") {
      return res.status(403).json({ error: "Only the CEO can modify the superadmin profile" });
    }

    if (role === "SUPERADMIN" && req.user.role !== "SUPERADMIN") {
      return res.status(403).json({ error: "Only the CEO can assign superadmin access" });
    }

    /** Only touch fields the client sends — avoids clearing manager/dept when updating role only. */
    const data = {};

    if (typeof designation === "string") {
      data.designation = designation;
    }

    if (typeof role === "string" && role.trim()) {
      data.role = role.trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "departmentId")) {
      const rawDept = departmentId;
      const nextDeptId = typeof rawDept === "string" && rawDept.trim() ? rawDept.trim() : null;
      if (nextDeptId) {
        const department = await prisma.department.findUnique({
          where: { id: nextDeptId },
        });

        if (!department) {
          return res.status(404).json({ error: "Department not found" });
        }
      }
      data.departmentId = nextDeptId;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "managerId")) {
      const rawMgr = managerId;
      const nextManagerId = typeof rawMgr === "string" && rawMgr.trim() ? rawMgr.trim() : null;
      if (nextManagerId) {
        const manager = await prisma.user.findUnique({
          where: { id: nextManagerId },
        });

        if (!manager || !["SUPERADMIN", "ADMIN", "MANAGER"].includes(manager.role)) {
          return res.status(400).json({ error: "Selected manager is invalid" });
        }

        if (manager.id === req.params.id) {
          return res.status(400).json({ error: "A user cannot report to themselves" });
        }
      }
      data.managerId = nextManagerId;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No assignment fields to update" });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: toPublicUserSelect(),
    });

    emitCRMEvent("org:updated", {
      type: "user_assignment_updated",
      userId: user.id,
      role: user.role,
      managerId: user.manager?.id ?? null,
      departmentId: user.department?.id ?? null,
    });

    return res.json(user);
  } catch (err) {
    return sendSafeError(res, err, "Unable to update user password");
  }
}

export async function getMyProfile(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: toPublicUserSelect(),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (err) {
    return sendSafeError(res, err, "Unable to reset user password");
  }
}

export async function updateMyProfile(req, res) {
  try {
    const { name, designation, password, email } = req.body;

    if (typeof email === "string" && email.trim()) {
      return res.status(403).json({
        error: "Email change requires leadership approval. Contact your manager/admin.",
      });
    }

    const existing = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const nextName = typeof name === "string" ? name.trim() : "";
    if (typeof name === "string" && !nextName) {
      return res.status(400).json({ error: "Name cannot be empty" });
    }

    const data = {
      ...(typeof name === "string" ? { name: nextName } : {}),
      ...(typeof designation === "string" ? { designation } : {}),
      ...(typeof password === "string" && password.trim()
        ? { password: await bcrypt.hash(password.trim(), 10) }
        : {}),
    };

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data,
      select: toPublicUserSelect(),
    });

    emitCRMEvent("org:updated", {
      type: "profile_updated",
      userId: user.id,
    });

    return res.json(user);
  } catch (err) {
    return sendSafeError(res, err, "Unable to update user");
  }
}

export async function updateUserProfileByLeadership(req, res) {
  try {
    const { name, designation, email, password } = req.body;

    const existing = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        role: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    if (existing.role === "SUPERADMIN" && req.user.role !== "SUPERADMIN") {
      return res.status(403).json({ error: "Only the CEO can edit superadmin profile details" });
    }

    if (req.user.role === "MANAGER") {
      const scopeUser = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { managerId: true, role: true },
      });
      if (!scopeUser || scopeUser.managerId !== req.user.userId) {
        return res.status(403).json({ error: "You can only edit profiles for your direct reports." });
      }
      if (["SUPERADMIN", "ADMIN"].includes(scopeUser.role)) {
        return res.status(403).json({ error: "You cannot edit this profile." });
      }
    }

    if (typeof email === "string" && email.trim()) {
      const duplicate = await prisma.user.findUnique({
        where: { email: email.trim() },
        select: { id: true },
      });

      if (duplicate && duplicate.id !== req.params.id) {
        return res.status(409).json({ error: "Email is already in use" });
      }
    }

    const nextName = typeof name === "string" ? name.trim() : "";
    if (typeof name === "string" && !nextName) {
      return res.status(400).json({ error: "Name cannot be empty" });
    }

    const data = {
      ...(typeof name === "string" ? { name: nextName } : {}),
      ...(typeof designation === "string" ? { designation } : {}),
      ...(typeof email === "string" && email.trim() ? { email: email.trim() } : {}),
      ...(typeof password === "string" && password.trim()
        ? { password: await bcrypt.hash(password.trim(), 10) }
        : {}),
    };

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: toPublicUserSelect(),
    });

    emitCRMEvent("org:updated", {
      type: "profile_updated_by_leadership",
      userId: user.id,
    });

    return res.json(user);
  } catch (err) {
    return sendSafeError(res, err, "Unable to update profile");
  }
}

export async function deleteUser(req, res) {
  try {
    const id = req.params.id;
    const actor = req.user;

    if (!id) {
      return res.status(400).json({ error: "User id is required" });
    }

    if (id === actor.userId) {
      return res.status(400).json({ error: "You cannot delete your own account from here." });
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, managerId: true },
    });

    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    if (target.role === "SUPERADMIN" && actor.role !== "SUPERADMIN") {
      return res.status(403).json({ error: "Only the CEO can remove a superadmin." });
    }

    if (actor.role === "ADMIN" && target.role === "SUPERADMIN") {
      return res.status(403).json({ error: "Only the CEO can remove a superadmin." });
    }

    if (actor.role === "MANAGER") {
      if (target.managerId !== actor.userId) {
        return res.status(403).json({ error: "You can only delete members on your team." });
      }
      if (!["EMPLOYEE", "INTERN"].includes(target.role)) {
        return res.status(403).json({ error: "You cannot delete this role." });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.department.updateMany({ where: { headId: id }, data: { headId: null } });
      await tx.project.updateMany({ where: { ownerId: id }, data: { ownerId: null } });
      await tx.taskIssue.updateMany({ where: { resolvedById: id }, data: { resolvedById: null } });
      await tx.user.updateMany({ where: { managerId: id }, data: { managerId: null } });
      await tx.user.updateMany({ where: { createdById: id }, data: { createdById: null } });
      await tx.user.delete({ where: { id } });
    });

    emitCRMEvent("org:updated", {
      type: "user_deleted",
      userId: id,
    });

    return res.status(204).send();
  } catch (err) {
    return sendSafeError(res, err, "Unable to delete user");
  }
}

export async function getUserAnalytics(req, res) {
  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        departmentId: true,
        managerId: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdAt: true,
      },
    });

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const isSuperView = req.user.role === "SUPERADMIN" || req.user.role === "ADMIN";
    const canManagerView =
      req.user.role === "MANAGER" &&
      (targetUser.id === req.user.userId || targetUser.managerId === req.user.userId);

    if (!isSuperView && !canManagerView) {
      return res.status(403).json({ error: "You do not have access to this team member analytics" });
    }

    const heatmapDays = getLastNDays(35);
    const trendDays = getLastNDays(14);
    const heatmapStart = heatmapDays[0];
    const trendStart = trendDays[0];

    const [
      totalTasks,
      completedTasks,
      pendingTasks,
      activeAttendance,
      attendanceRecords,
      trendTasks,
      progressTasks,
      recentTasks,
    ] = await Promise.all([
      prisma.task.count({
        where: {
          assignments: {
            some: {
              userId: targetUser.id,
            },
          },
        },
      }),
      prisma.task.count({
        where: {
          status: "DONE",
          assignments: {
            some: {
              userId: targetUser.id,
            },
          },
        },
      }),
      prisma.task.count({
        where: {
          status: { in: ["TODO", "IN_PROGRESS"] },
          assignments: {
            some: {
              userId: targetUser.id,
            },
          },
        },
      }),
      prisma.attendance.findFirst({
        where: {
          userId: targetUser.id,
          checkOut: null,
        },
        orderBy: { checkIn: "desc" },
      }),
      prisma.attendance.findMany({
        where: {
          userId: targetUser.id,
          date: { gte: heatmapStart },
        },
        select: {
          date: true,
          checkIn: true,
          checkOut: true,
        },
      }),
      prisma.task.findMany({
        where: {
          assignments: {
            some: {
              userId: targetUser.id,
            },
          },
          OR: [{ createdAt: { gte: trendStart } }, { updatedAt: { gte: trendStart } }],
        },
        select: { createdAt: true, updatedAt: true, progress: true, status: true },
      }),
      prisma.task.findMany({
        where: {
          assignments: {
            some: {
              userId: targetUser.id,
            },
          },
        },
        select: {
          progress: true,
          status: true,
        },
      }),
      prisma.task.findMany({
        where: {
          assignments: {
            some: {
              userId: targetUser.id,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        include: {
          assignments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
          },
          checklistItems: {
            orderBy: { createdAt: "asc" },
          },
          issues: {
            orderBy: { createdAt: "desc" },
            include: {
              reporter: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
              resolvedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const attendanceHeatmap = buildAttendanceHeatmap(attendanceRecords, heatmapDays);
    const workingHoursTrend = buildWorkingHoursTrend(attendanceRecords, trendDays);
    const taskProgressTrend = buildTaskProgressTrend(trendTasks, trendDays);

    const attendanceDays = attendanceRecords.filter((record) => getDurationHours(record.checkIn, record.checkOut) > 0).length;
    const totalHours = attendanceRecords.reduce(
      (sum, record) => sum + getDurationHours(record.checkIn, record.checkOut),
      0
    );
    const avgDailyHours = attendanceDays ? Number((totalHours / attendanceDays).toFixed(2)) : 0;
    const avgProgress = progressTasks.length
      ? Math.round(progressTasks.reduce((sum, task) => sum + task.progress, 0) / progressTasks.length)
      : 0;

    const taskStatusBreakdown = [
      {
        label: "To do",
        value: progressTasks.filter((task) => task.status === "TODO").length,
      },
      {
        label: "In progress",
        value: progressTasks.filter((task) => task.status === "IN_PROGRESS").length,
      },
      {
        label: "Done",
        value: progressTasks.filter((task) => task.status === "DONE").length,
      },
    ];

    return res.json({
      user: targetUser,
      metrics: {
        totalTasks,
        completedTasks,
        pendingTasks,
        checkedIn: Boolean(activeAttendance),
        avgProgress,
        avgDailyHours,
        attendanceDays,
      },
      taskStatusBreakdown,
      recentTasks,
      analytics: {
        attendanceHeatmap,
        workingHoursTrend,
        taskProgressTrend,
      },
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch activity metrics");
  }
}
