import prisma from "../config/db.js";
import { sendSafeError } from "../middleware/error.middleware.js";

function parseIsoDate(value, fallback) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return fallback;
  const d = new Date(raw);
  // Invalid Date -> NaN time
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toShortLabel(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getLastNDays(dayCount, endAt = new Date()) {
  const days = [];
  const now = new Date(endAt);
  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(now.getDate() - offset);
    days.push(date);
  }
  return days;
}

function getDurationHours(checkIn, checkOut) {
  const end = checkOut ? new Date(checkOut) : new Date();
  const start = new Date(checkIn);
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  return Number((diffMs / (1000 * 60 * 60)).toFixed(2));
}

function toPercent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function buildDaysRange(startDate, endDate) {
  const days = [];
  const cursor = startOfDay(startDate);
  const end = startOfDay(endDate);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function buildWorkingHoursTrend(records, days) {
  const map = new Map();
  for (const day of days) {
    map.set(toDateKey(day), { totalHours: 0, count: 0 });
  }
  for (const record of records) {
    const key = toDateKey(new Date(record.date));
    if (!map.has(key)) continue;
    const bucket = map.get(key);
    bucket.totalHours += getDurationHours(record.checkIn, record.checkOut);
    bucket.count += 1;
  }
  return days.map((day) => {
    const key = toDateKey(day);
    const bucket = map.get(key);
    const hours = bucket.count ? Number((bucket.totalHours / bucket.count).toFixed(2)) : 0;
    return { date: key, label: toShortLabel(day), hours };
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
      const bucket = map.get(updatedKey);
      bucket.progressSum += task.progress;
      bucket.progressCount += 1;
      if (task.status === "DONE") bucket.completed += 1;
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
      avgProgress: bucket.progressCount ? Math.round(bucket.progressSum / bucket.progressCount) : 0,
    };
  });
}

function normalizeId(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || null;
}

function buildReportRange(req) {
  const now = new Date();
  const fallbackEnd = endOfDay(now);
  const fallbackStart = startOfDay(new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000));

  const start = startOfDay(parseIsoDate(req.query.startDate, fallbackStart));
  const end = endOfDay(parseIsoDate(req.query.endDate, fallbackEnd));
  if (start > end) {
    return { start: fallbackStart, end: fallbackEnd };
  }
  return { start, end };
}

function buildTaskWhere({ start, end, employeeId, departmentId, projectId }) {
  const where = {
    createdAt: { lte: end },
  };

  // For tasks, "date-range" is interpreted as created/updated activity window.
  // We'll apply a window on OR(createdAt, updatedAt) and still allow older tasks when project/employee is scoped.
  where.OR = [{ createdAt: { gte: start } }, { updatedAt: { gte: start } }];

  if (normalizeId(projectId)) {
    where.projectId = projectId;
  }

  if (normalizeId(employeeId)) {
    where.assignments = { some: { userId: employeeId } };
  }

  if (normalizeId(departmentId)) {
    where.OR = [
      { project: { departmentId } },
      { assignments: { some: { user: { departmentId } } } },
      { createdAt: { gte: start } },
      { updatedAt: { gte: start } },
    ];
  }

  return where;
}

function buildAttendanceWhere({ start, end, employeeId, departmentId }) {
  const where = {
    date: { gte: start, lte: end },
  };
  if (normalizeId(employeeId)) {
    where.userId = employeeId;
  }
  if (normalizeId(departmentId)) {
    where.user = { departmentId };
  }
  return where;
}

function buildLeaveWhere({ start, end, employeeId, departmentId }) {
  const where = {
    requestedAt: { gte: start, lte: end },
  };
  if (normalizeId(employeeId)) {
    where.userId = employeeId;
  }
  if (normalizeId(departmentId)) {
    where.user = { departmentId };
  }
  return where;
}

export async function getExecutiveReport(req, res) {
  try {
    const { start, end } = buildReportRange(req);
    const employeeId = normalizeId(req.query.employeeId);
    const departmentId = normalizeId(req.query.departmentId);
    const projectId = normalizeId(req.query.projectId);

    const trendDays = buildDaysRange(start, end).slice(-60); // clamp to last 60 days for payload safety

    const [employeeCount, internCount, departmentCount, projectCount] = await Promise.all([
      prisma.user.count({ where: { role: { in: ["EMPLOYEE", "MANAGER", "ADMIN", "SUPERADMIN"] } } }),
      prisma.user.count({ where: { role: "INTERN" } }),
      prisma.department.count(),
      prisma.project.count(),
    ]);

    const taskWhere = buildTaskWhere({ start, end, employeeId, departmentId, projectId });
    const tasks = await prisma.task.findMany({
      where: taskWhere,
      select: { id: true, createdAt: true, updatedAt: true, progress: true, status: true, deadlineAt: true, projectId: true },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "DONE" || t.progress >= 100).length;
    const pendingTasks = totalTasks - completedTasks;
    const completionRate = toPercent(completedTasks, totalTasks);

    const attendanceWhere = buildAttendanceWhere({ start, end, employeeId, departmentId });
    const attendances = await prisma.attendance.findMany({
      where: attendanceWhere,
      select: { date: true, checkIn: true, checkOut: true, userId: true },
    });

    const totalAttendanceHours = attendances.reduce((sum, a) => sum + getDurationHours(a.checkIn, a.checkOut), 0);
    const attendanceDays = new Set(attendances.map((a) => `${a.userId}:${toDateKey(new Date(a.date))}`)).size;
    const avgDailyHours = attendanceDays ? Number((totalAttendanceHours / attendanceDays).toFixed(2)) : 0;

    const workingHoursTrend = buildWorkingHoursTrend(attendances, trendDays);
    const taskProgressTrend = buildTaskProgressTrend(tasks, trendDays);

    // Basic company growth proxy: projects created + tasks created
    const growthSignals = await prisma.project.findMany({
      where: { createdAt: { gte: start, lte: end }, ...(departmentId ? { departmentId } : {}) },
      select: { createdAt: true },
    });

    const projectsCreatedByDay = (() => {
      const map = new Map(trendDays.map((d) => [toDateKey(d), 0]));
      for (const p of growthSignals) {
        const key = toDateKey(new Date(p.createdAt));
        if (map.has(key)) map.set(key, map.get(key) + 1);
      }
      return trendDays.map((d) => ({ date: toDateKey(d), label: toShortLabel(d), value: map.get(toDateKey(d)) ?? 0 }));
    })();

    return res.json({
      range: { start: start.toISOString(), end: end.toISOString() },
      filters: { employeeId, departmentId, projectId },
      kpis: {
        employeeCount,
        internCount,
        departmentCount,
        projectCount,
        totalTasks,
        completedTasks,
        pendingTasks,
        completionRate,
        attendanceEntries: attendances.length,
        avgDailyHours,
      },
      charts: {
        workingHoursTrend,
        taskProgressTrend,
        projectsCreatedByDay,
      },
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch executive report");
  }
}

export async function getEmployeeReportDirectory(req, res) {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ["SUPERADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "INTERN"] } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        departmentId: true,
        managerId: true,
        avatarUrl: true,
        authProvider: true,
        department: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    return res.json({ users });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch employee directory");
  }
}

export async function getDepartmentReport(req, res) {
  try {
    const { start, end } = buildReportRange(req);
    const departmentId = normalizeId(req.query.departmentId);

    const departments = await prisma.department.findMany({
      where: departmentId ? { id: departmentId } : undefined,
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    });

    const deptIds = departments.map((d) => d.id);

    const projects = await prisma.project.findMany({
      where: { departmentId: { in: deptIds } },
      select: { id: true, departmentId: true, createdAt: true },
    });
    const projectIds = projects.map((p) => p.id);

    const tasks = await prisma.task.findMany({
      where: {
        OR: [{ createdAt: { gte: start, lte: end } }, { updatedAt: { gte: start, lte: end } }],
        ...(projectIds.length ? { projectId: { in: projectIds } } : { projectId: null }),
      },
      select: { id: true, status: true, progress: true, projectId: true },
    });

    const users = await prisma.user.findMany({
      where: { departmentId: { in: deptIds } },
      select: { id: true, role: true, departmentId: true },
    });

    const rollupByDept = new Map(deptIds.map((id) => [id, { members: 0, managers: 0, interns: 0, projects: 0, totalTasks: 0, done: 0, avgProgress: 0, progressSum: 0, progressCount: 0 }]));

    for (const u of users) {
      const b = rollupByDept.get(u.departmentId);
      if (!b) continue;
      b.members += 1;
      if (u.role === "MANAGER" || u.role === "ADMIN" || u.role === "SUPERADMIN") b.managers += 1;
      if (u.role === "INTERN") b.interns += 1;
    }

    for (const p of projects) {
      const b = rollupByDept.get(p.departmentId);
      if (!b) continue;
      b.projects += 1;
    }

    const projectDeptMap = new Map(projects.map((p) => [p.id, p.departmentId]));
    for (const t of tasks) {
      const dept = projectDeptMap.get(t.projectId);
      if (!dept) continue;
      const b = rollupByDept.get(dept);
      if (!b) continue;
      b.totalTasks += 1;
      if (t.status === "DONE" || t.progress >= 100) b.done += 1;
      b.progressSum += t.progress;
      b.progressCount += 1;
    }

    const rows = departments.map((d) => {
      const b = rollupByDept.get(d.id);
      const avgProgress = b?.progressCount ? Math.round(b.progressSum / b.progressCount) : 0;
      const completionRate = toPercent(b?.done ?? 0, b?.totalTasks ?? 0);
      return {
        departmentId: d.id,
        departmentName: d.name,
        departmentCode: d.code,
        members: b?.members ?? 0,
        managers: b?.managers ?? 0,
        interns: b?.interns ?? 0,
        totalProjects: b?.projects ?? 0,
        totalTasks: b?.totalTasks ?? 0,
        completedTasks: b?.done ?? 0,
        completionRate,
        avgProgress,
      };
    });

    return res.json({
      range: { start: start.toISOString(), end: end.toISOString() },
      filters: { departmentId },
      rows,
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch department report");
  }
}

export async function getProjectReport(req, res) {
  try {
    const { start, end } = buildReportRange(req);
    const projectId = normalizeId(req.query.projectId);
    const departmentId = normalizeId(req.query.departmentId);

    const projects = await prisma.project.findMany({
      where: {
        ...(projectId ? { id: projectId } : {}),
        ...(departmentId ? { departmentId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, departmentId: true, createdAt: true, updatedAt: true },
    });
    const projectIds = projects.map((p) => p.id);

    const tasks = await prisma.task.findMany({
      where: {
        projectId: projectIds.length ? { in: projectIds } : undefined,
        OR: [{ createdAt: { gte: start, lte: end } }, { updatedAt: { gte: start, lte: end } }],
      },
      select: { id: true, projectId: true, status: true, progress: true, deadlineAt: true, createdAt: true, updatedAt: true },
    });

    const statsByProject = new Map(projectIds.map((id) => [id, { total: 0, todo: 0, inProgress: 0, done: 0, progressSum: 0, progressCount: 0, overdue: 0 }]));
    const now = new Date();
    for (const t of tasks) {
      const b = statsByProject.get(t.projectId);
      if (!b) continue;
      b.total += 1;
      if (t.status === "DONE" || t.progress >= 100) b.done += 1;
      else if (t.status === "IN_PROGRESS") b.inProgress += 1;
      else b.todo += 1;
      b.progressSum += t.progress;
      b.progressCount += 1;
      if (t.deadlineAt && t.status !== "DONE" && new Date(t.deadlineAt) < now) b.overdue += 1;
    }

    const rows = projects.map((p) => {
      const b = statsByProject.get(p.id);
      const avgProgress = b?.progressCount ? Math.round(b.progressSum / b.progressCount) : 0;
      const completionRate = toPercent(b?.done ?? 0, b?.total ?? 0);
      return {
        projectId: p.id,
        projectName: p.name,
        departmentId: p.departmentId,
        totalTasks: b?.total ?? 0,
        todo: b?.todo ?? 0,
        inProgress: b?.inProgress ?? 0,
        done: b?.done ?? 0,
        completionRate,
        avgProgress,
        overdueTasks: b?.overdue ?? 0,
      };
    });

    return res.json({
      range: { start: start.toISOString(), end: end.toISOString() },
      filters: { projectId, departmentId },
      rows,
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch project report");
  }
}

export async function getAttendanceReport(req, res) {
  try {
    const { start, end } = buildReportRange(req);
    const employeeId = normalizeId(req.query.employeeId);
    const departmentId = normalizeId(req.query.departmentId);

    const days = buildDaysRange(start, end).slice(-90);
    const where = buildAttendanceWhere({ start, end, employeeId, departmentId });
    const records = await prisma.attendance.findMany({
      where,
      select: {
        date: true,
        checkIn: true,
        checkOut: true,
        userId: true,
        user: { select: { id: true, name: true, role: true, departmentId: true } },
      },
    });

    const trend = buildWorkingHoursTrend(records, days);

    const byEmployee = new Map();
    for (const r of records) {
      const key = r.userId;
      const existing = byEmployee.get(key) ?? { userId: key, name: r.user?.name ?? "User", role: r.user?.role ?? "EMPLOYEE", totalHours: 0, attendanceDays: new Set() };
      existing.totalHours += getDurationHours(r.checkIn, r.checkOut);
      existing.attendanceDays.add(toDateKey(new Date(r.date)));
      byEmployee.set(key, existing);
    }

    const topEmployees = Array.from(byEmployee.values())
      .map((x) => ({ userId: x.userId, name: x.name, role: x.role, totalHours: Number(x.totalHours.toFixed(2)), attendanceDays: x.attendanceDays.size }))
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 10);

    return res.json({
      range: { start: start.toISOString(), end: end.toISOString() },
      filters: { employeeId, departmentId },
      kpis: {
        totalEntries: records.length,
        totalHours: Number(records.reduce((s, r) => s + getDurationHours(r.checkIn, r.checkOut), 0).toFixed(2)),
        uniqueEmployees: new Set(records.map((r) => r.userId)).size,
      },
      charts: { workingHoursTrend: trend },
      tables: { topEmployees },
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch attendance report");
  }
}

export async function getTaskSlaReport(req, res) {
  try {
    const { start, end } = buildReportRange(req);
    const employeeId = normalizeId(req.query.employeeId);
    const departmentId = normalizeId(req.query.departmentId);
    const projectId = normalizeId(req.query.projectId);

    const tasks = await prisma.task.findMany({
      where: {
        ...buildTaskWhere({ start, end, employeeId, departmentId, projectId }),
        deadlineAt: { not: null },
      },
      select: {
        id: true,
        title: true,
        status: true,
        progress: true,
        deadlineAt: true,
        updatedAt: true,
        project: { select: { id: true, name: true, departmentId: true } },
        assignments: { select: { user: { select: { id: true, name: true, role: true } } } },
      },
      take: 600,
      orderBy: { updatedAt: "desc" },
    });

    const now = new Date();
    let overdueOpen = 0;
    let completedLate = 0;
    let completedOnTime = 0;

    const rows = tasks.map((t) => {
      const deadline = t.deadlineAt ? new Date(t.deadlineAt) : null;
      const completed = t.status === "DONE" || t.progress >= 100;
      const late = Boolean(deadline && new Date(t.updatedAt) > deadline && completed);
      const overdue = Boolean(deadline && !completed && now > deadline);

      if (overdue) overdueOpen += 1;
      if (late) completedLate += 1;
      if (completed && !late) completedOnTime += 1;

      return {
        taskId: t.id,
        title: t.title,
        status: t.status,
        progress: t.progress,
        deadlineAt: deadline ? deadline.toISOString() : null,
        updatedAt: t.updatedAt.toISOString(),
        projectName: t.project?.name ?? "—",
        assignees: (t.assignments ?? []).map((a) => a.user?.name).filter(Boolean),
        isOverdue: overdue,
        completedLate: late,
      };
    });

    return res.json({
      range: { start: start.toISOString(), end: end.toISOString() },
      filters: { employeeId, departmentId, projectId },
      kpis: {
        tasksWithDeadline: tasks.length,
        overdueOpen,
        completedOnTime,
        completedLate,
        onTimeRate: toPercent(completedOnTime, completedOnTime + completedLate),
      },
      rows,
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch task SLA report");
  }
}

export async function getLeaveReport(req, res) {
  try {
    const { start, end } = buildReportRange(req);
    const employeeId = normalizeId(req.query.employeeId);
    const departmentId = normalizeId(req.query.departmentId);

    const where = buildLeaveWhere({ start, end, employeeId, departmentId });
    const leaves = await prisma.leaveRequest.findMany({
      where,
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        requestedAt: true,
        user: { select: { id: true, name: true, role: true, departmentId: true } },
        leaveType: { select: { id: true, name: true } },
      },
      orderBy: { requestedAt: "desc" },
      take: 800,
    });

    const statusCounts = new Map();
    const typeCounts = new Map();

    for (const l of leaves) {
      statusCounts.set(l.status, (statusCounts.get(l.status) ?? 0) + 1);
      typeCounts.set(l.leaveType?.name ?? "Unknown", (typeCounts.get(l.leaveType?.name ?? "Unknown") ?? 0) + 1);
    }

    const statusBreakdown = Array.from(statusCounts.entries()).map(([label, value]) => ({ label, value }));
    const typeBreakdown = Array.from(typeCounts.entries()).map(([label, value]) => ({ label, value }));

    return res.json({
      range: { start: start.toISOString(), end: end.toISOString() },
      filters: { employeeId, departmentId },
      kpis: { totalRequests: leaves.length },
      charts: { statusBreakdown, typeBreakdown },
      rows: leaves.map((l) => ({
        id: l.id,
        employeeName: l.user?.name ?? "—",
        role: l.user?.role ?? "EMPLOYEE",
        status: l.status,
        leaveType: l.leaveType?.name ?? "Unknown",
        startDate: l.startDate.toISOString(),
        endDate: l.endDate.toISOString(),
        requestedAt: l.requestedAt.toISOString(),
      })),
    });
  } catch (err) {
    return sendSafeError(res, err, "Unable to fetch leave report");
  }
}

function csvEscape(value) {
  const raw = value == null ? "" : String(value);
  if (raw.includes('"') || raw.includes(",") || raw.includes("\n") || raw.includes("\r")) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [];
  lines.push(headers.map(csvEscape).join(","));
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function exportReportCsv(req, res) {
  try {
    const report = String(req.query.report ?? "").trim();
    const { start, end } = buildReportRange(req);
    const employeeId = normalizeId(req.query.employeeId);
    const departmentId = normalizeId(req.query.departmentId);
    const projectId = normalizeId(req.query.projectId);

    let payloadRows = [];
    if (report === "departments") {
      const departments = await prisma.department.findMany({
        where: departmentId ? { id: departmentId } : undefined,
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      });
      const deptIds = departments.map((d) => d.id);
      const projects = await prisma.project.findMany({
        where: { departmentId: { in: deptIds } },
        select: { id: true, departmentId: true },
      });
      const projectIds = projects.map((p) => p.id);
      const tasks = await prisma.task.findMany({
        where: {
          OR: [{ createdAt: { gte: start, lte: end } }, { updatedAt: { gte: start, lte: end } }],
          ...(projectIds.length ? { projectId: { in: projectIds } } : { projectId: null }),
        },
        select: { status: true, progress: true, projectId: true },
      });
      const users = await prisma.user.findMany({
        where: { departmentId: { in: deptIds } },
        select: { role: true, departmentId: true },
      });
      const rollupByDept = new Map(
        deptIds.map((id) => [
          id,
          { members: 0, managers: 0, interns: 0, projects: 0, totalTasks: 0, done: 0, progressSum: 0, progressCount: 0 },
        ])
      );
      for (const u of users) {
        const b = rollupByDept.get(u.departmentId);
        if (!b) continue;
        b.members += 1;
        if (u.role === "MANAGER" || u.role === "ADMIN" || u.role === "SUPERADMIN") b.managers += 1;
        if (u.role === "INTERN") b.interns += 1;
      }
      for (const p of projects) {
        const b = rollupByDept.get(p.departmentId);
        if (b) b.projects += 1;
      }
      const projectDeptMap = new Map(projects.map((p) => [p.id, p.departmentId]));
      for (const t of tasks) {
        const dept = projectDeptMap.get(t.projectId);
        const b = dept ? rollupByDept.get(dept) : null;
        if (!b) continue;
        b.totalTasks += 1;
        if (t.status === "DONE" || t.progress >= 100) b.done += 1;
        b.progressSum += t.progress;
        b.progressCount += 1;
      }
      payloadRows = departments.map((d) => {
        const b = rollupByDept.get(d.id);
        const avgProgress = b?.progressCount ? Math.round(b.progressSum / b.progressCount) : 0;
        return {
          departmentId: d.id,
          departmentName: d.name,
          departmentCode: d.code,
          members: b?.members ?? 0,
          managers: b?.managers ?? 0,
          interns: b?.interns ?? 0,
          totalProjects: b?.projects ?? 0,
          totalTasks: b?.totalTasks ?? 0,
          completedTasks: b?.done ?? 0,
          completionRate: toPercent(b?.done ?? 0, b?.totalTasks ?? 0),
          avgProgress,
        };
      });
    } else if (report === "projects") {
      const projects = await prisma.project.findMany({
        where: {
          ...(projectId ? { id: projectId } : {}),
          ...(departmentId ? { departmentId } : {}),
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, departmentId: true },
      });
      const projectIds = projects.map((p) => p.id);
      const tasks = await prisma.task.findMany({
        where: {
          projectId: projectIds.length ? { in: projectIds } : undefined,
          OR: [{ createdAt: { gte: start, lte: end } }, { updatedAt: { gte: start, lte: end } }],
        },
        select: { projectId: true, status: true, progress: true, deadlineAt: true, updatedAt: true },
      });
      const statsByProject = new Map(
        projectIds.map((id) => [id, { total: 0, todo: 0, inProgress: 0, done: 0, progressSum: 0, progressCount: 0, overdue: 0 }])
      );
      const now = new Date();
      for (const t of tasks) {
        const b = statsByProject.get(t.projectId);
        if (!b) continue;
        b.total += 1;
        if (t.status === "DONE" || t.progress >= 100) b.done += 1;
        else if (t.status === "IN_PROGRESS") b.inProgress += 1;
        else b.todo += 1;
        b.progressSum += t.progress;
        b.progressCount += 1;
        if (t.deadlineAt && t.status !== "DONE" && new Date(t.deadlineAt) < now) b.overdue += 1;
      }
      payloadRows = projects.map((p) => {
        const b = statsByProject.get(p.id);
        const avgProgress = b?.progressCount ? Math.round(b.progressSum / b.progressCount) : 0;
        return {
          projectId: p.id,
          projectName: p.name,
          departmentId: p.departmentId,
          totalTasks: b?.total ?? 0,
          todo: b?.todo ?? 0,
          inProgress: b?.inProgress ?? 0,
          done: b?.done ?? 0,
          completionRate: toPercent(b?.done ?? 0, b?.total ?? 0),
          avgProgress,
          overdueTasks: b?.overdue ?? 0,
        };
      });
    } else if (report === "task-sla") {
      const tasks = await prisma.task.findMany({
        where: {
          ...buildTaskWhere({ start, end, employeeId, departmentId, projectId }),
          deadlineAt: { not: null },
        },
        select: {
          id: true,
          title: true,
          status: true,
          progress: true,
          deadlineAt: true,
          updatedAt: true,
        },
        take: 800,
        orderBy: { updatedAt: "desc" },
      });
      const now = new Date();
      payloadRows = tasks.map((t) => {
        const deadline = t.deadlineAt ? new Date(t.deadlineAt) : null;
        const completed = t.status === "DONE" || t.progress >= 100;
        const late = Boolean(deadline && new Date(t.updatedAt) > deadline && completed);
        const overdue = Boolean(deadline && !completed && now > deadline);
        return {
          taskId: t.id,
          title: t.title,
          status: t.status,
          progress: t.progress,
          deadlineAt: deadline ? deadline.toISOString() : "",
          updatedAt: t.updatedAt.toISOString(),
          isOverdue: overdue,
          completedLate: late,
        };
      });
    } else if (report === "leaves") {
      const where = buildLeaveWhere({ start, end, employeeId, departmentId });
      const leaves = await prisma.leaveRequest.findMany({
        where,
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          requestedAt: true,
          user: { select: { name: true, role: true } },
          leaveType: { select: { name: true } },
        },
        orderBy: { requestedAt: "desc" },
        take: 1200,
      });
      payloadRows = leaves.map((l) => ({
        id: l.id,
        employeeName: l.user?.name ?? "—",
        role: l.user?.role ?? "EMPLOYEE",
        status: l.status,
        leaveType: l.leaveType?.name ?? "Unknown",
        startDate: l.startDate.toISOString(),
        endDate: l.endDate.toISOString(),
        requestedAt: l.requestedAt.toISOString(),
      }));
    } else if (report === "attendance") {
      const where = buildAttendanceWhere({ start, end, employeeId, departmentId });
      const records = await prisma.attendance.findMany({
        where,
        select: { date: true, checkIn: true, checkOut: true, userId: true, user: { select: { name: true, role: true } } },
      });
      const byEmployee = new Map();
      for (const r of records) {
        const existing = byEmployee.get(r.userId) ?? { userId: r.userId, name: r.user?.name ?? "User", role: r.user?.role ?? "EMPLOYEE", totalHours: 0, days: new Set() };
        existing.totalHours += getDurationHours(r.checkIn, r.checkOut);
        existing.days.add(toDateKey(new Date(r.date)));
        byEmployee.set(r.userId, existing);
      }
      payloadRows = Array.from(byEmployee.values())
        .map((x) => ({ userId: x.userId, name: x.name, role: x.role, totalHours: Number(x.totalHours.toFixed(2)), attendanceDays: x.days.size }))
        .sort((a, b) => b.totalHours - a.totalHours);
    } else {
      return res.status(400).json({ error: "Unknown report type" });
    }

    const csv = toCsv(payloadRows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="report-${report}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    return sendSafeError(res, err, "Unable to export CSV");
  }
}

export async function exportReportPdf(_req, res) {
  // PDF export is implemented in a separate file to avoid loading pdfkit unless needed.
  try {
    const { buildPdfResponse } = await import("../services/report-pdf.service.js");
    return await buildPdfResponse(_req, res);
  } catch (err) {
    return sendSafeError(res, err, "Unable to export PDF");
  }
}

