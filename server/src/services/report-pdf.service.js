import PDFDocument from "pdfkit";
import prisma from "../config/db.js";

function parseIsoDate(value, fallback) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return fallback;
  const d = new Date(raw);
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

function buildReportRange(req) {
  const now = new Date();
  const fallbackEnd = endOfDay(now);
  const fallbackStart = startOfDay(new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000));
  const start = startOfDay(parseIsoDate(req.query.startDate, fallbackStart));
  const end = endOfDay(parseIsoDate(req.query.endDate, fallbackEnd));
  if (start > end) return { start: fallbackStart, end: fallbackEnd };
  return { start, end };
}

function normalizeId(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || null;
}

function csvSafe(value) {
  const raw = value == null ? "" : String(value);
  return raw.replace(/\s+/g, " ").trim();
}

function drawKeyValue(doc, key, value) {
  doc.font("Helvetica-Bold").text(`${key}: `, { continued: true });
  doc.font("Helvetica").text(String(value ?? "—"));
}

function drawTable(doc, headers, rows) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = Math.max(70, Math.floor(pageWidth / Math.max(1, headers.length)));
  const rowHeight = 16;

  const ensureSpace = (needed = rowHeight * 2) => {
    const bottomY = doc.page.height - doc.page.margins.bottom;
    if (doc.y + needed > bottomY) doc.addPage();
  };

  ensureSpace(rowHeight * 3);
  doc.font("Helvetica-Bold").fontSize(10);
  headers.forEach((h, i) => {
    doc.text(h, doc.page.margins.left + i * colWidth, doc.y, { width: colWidth, ellipsis: true });
  });
  doc.moveDown(0.8);
  doc.font("Helvetica").fontSize(9);

  for (const row of rows) {
    ensureSpace(rowHeight * 1.6);
    headers.forEach((h, i) => {
      doc.text(csvSafe(row[h]), doc.page.margins.left + i * colWidth, doc.y, { width: colWidth, ellipsis: true });
    });
    doc.moveDown(0.8);
  }
}

async function buildRowsForReport(req) {
  const report = String(req.query.report ?? "").trim();
  const { start, end } = buildReportRange(req);
  const employeeId = normalizeId(req.query.employeeId);
  const departmentId = normalizeId(req.query.departmentId);
  const projectId = normalizeId(req.query.projectId);

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

    const byDept = new Map(
      deptIds.map((id) => [
        id,
        { members: 0, projects: 0, totalTasks: 0, completedTasks: 0, progressSum: 0, progressCount: 0 },
      ])
    );
    for (const u of users) {
      const b = byDept.get(u.departmentId);
      if (b) b.members += 1;
    }
    for (const p of projects) {
      const b = byDept.get(p.departmentId);
      if (b) b.projects += 1;
    }
    const projectToDept = new Map(projects.map((p) => [p.id, p.departmentId]));
    for (const t of tasks) {
      const dept = projectToDept.get(t.projectId);
      const b = dept ? byDept.get(dept) : null;
      if (!b) continue;
      b.totalTasks += 1;
      if (t.status === "DONE" || t.progress >= 100) b.completedTasks += 1;
      b.progressSum += t.progress;
      b.progressCount += 1;
    }

    return {
      title: "Department Report",
      meta: { start, end, employeeId, departmentId, projectId },
      headers: ["departmentName", "members", "totalProjects", "totalTasks", "completedTasks", "completionRate", "avgProgress"],
      rows: departments.slice(0, 25).map((d) => {
        const b = byDept.get(d.id) ?? { members: 0, projects: 0, totalTasks: 0, completedTasks: 0, progressSum: 0, progressCount: 0 };
        const completionRate = b.totalTasks ? Math.round((b.completedTasks / b.totalTasks) * 100) : 0;
        const avgProgress = b.progressCount ? Math.round(b.progressSum / b.progressCount) : 0;
        return {
          departmentName: d.name,
          members: b.members,
          totalProjects: b.projects,
          totalTasks: b.totalTasks,
          completedTasks: b.completedTasks,
          completionRate: `${completionRate}%`,
          avgProgress: `${avgProgress}%`,
        };
      }),
      note: departments.length > 25 ? "Showing first 25 departments. Use CSV for full list." : null,
    };
  }

  if (report === "projects") {
    const projects = await prisma.project.findMany({
      where: {
        ...(projectId ? { id: projectId } : {}),
        ...(departmentId ? { departmentId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, departmentId: true },
      take: 50,
    });
    const projectIds = projects.map((p) => p.id);
    const tasks = await prisma.task.findMany({
      where: {
        projectId: projectIds.length ? { in: projectIds } : undefined,
        OR: [{ createdAt: { gte: start, lte: end } }, { updatedAt: { gte: start, lte: end } }],
      },
      select: { projectId: true, status: true, progress: true, deadlineAt: true },
    });
    const byProject = new Map(projectIds.map((id) => [id, { total: 0, done: 0, overdue: 0, progressSum: 0, progressCount: 0 }]));
    const now = new Date();
    for (const t of tasks) {
      const b = byProject.get(t.projectId);
      if (!b) continue;
      b.total += 1;
      if (t.status === "DONE" || t.progress >= 100) b.done += 1;
      if (t.deadlineAt && t.status !== "DONE" && new Date(t.deadlineAt) < now) b.overdue += 1;
      b.progressSum += t.progress;
      b.progressCount += 1;
    }
    return {
      title: "Project Health Report",
      meta: { start, end, employeeId, departmentId, projectId },
      headers: ["projectName", "totalTasks", "done", "completionRate", "avgProgress", "overdueTasks"],
      rows: projects.map((p) => {
        const b = byProject.get(p.id) ?? { total: 0, done: 0, overdue: 0, progressSum: 0, progressCount: 0 };
        const completionRate = b.total ? Math.round((b.done / b.total) * 100) : 0;
        const avgProgress = b.progressCount ? Math.round(b.progressSum / b.progressCount) : 0;
        return {
          projectName: p.name,
          totalTasks: b.total,
          done: b.done,
          completionRate: `${completionRate}%`,
          avgProgress: `${avgProgress}%`,
          overdueTasks: b.overdue,
        };
      }),
      note: "Projects are limited to 50 rows in PDF. Use CSV for full export.",
    };
  }

  if (report === "task-sla") {
    const tasks = await prisma.task.findMany({
      where: {
        deadlineAt: { not: null },
        ...(projectId ? { projectId } : {}),
        ...(employeeId ? { assignments: { some: { userId: employeeId } } } : {}),
        OR: [{ createdAt: { gte: start, lte: end } }, { updatedAt: { gte: start, lte: end } }],
      },
      select: { id: true, title: true, status: true, progress: true, deadlineAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });
    return {
      title: "Task SLA Report",
      meta: { start, end, employeeId, departmentId, projectId },
      headers: ["id", "title", "status", "progress", "deadlineAt", "updatedAt"],
      rows: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        progress: t.progress,
        deadlineAt: t.deadlineAt ? new Date(t.deadlineAt).toISOString().slice(0, 10) : "",
        updatedAt: t.updatedAt.toISOString().slice(0, 10),
      })),
      note: "This PDF is a snapshot. Use CSV for full list.",
    };
  }

  if (report === "leaves") {
    const leaves = await prisma.leaveRequest.findMany({
      where: {
        requestedAt: { gte: start, lte: end },
        ...(employeeId ? { userId: employeeId } : {}),
        ...(departmentId ? { user: { departmentId } } : {}),
      },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        requestedAt: true,
        user: { select: { name: true } },
        leaveType: { select: { name: true } },
      },
      orderBy: { requestedAt: "desc" },
      take: 40,
    });
    return {
      title: "Leave Report",
      meta: { start, end, employeeId, departmentId, projectId },
      headers: ["employee", "leaveType", "status", "startDate", "endDate", "requestedAt"],
      rows: leaves.map((l) => ({
        employee: l.user?.name ?? "—",
        leaveType: l.leaveType?.name ?? "Unknown",
        status: l.status,
        startDate: l.startDate.toISOString().slice(0, 10),
        endDate: l.endDate.toISOString().slice(0, 10),
        requestedAt: l.requestedAt.toISOString().slice(0, 10),
      })),
      note: "This PDF is a snapshot. Use CSV for full list.",
    };
  }

  if (report === "attendance") {
    const records = await prisma.attendance.findMany({
      where: {
        date: { gte: start, lte: end },
        ...(employeeId ? { userId: employeeId } : {}),
        ...(departmentId ? { user: { departmentId } } : {}),
      },
      select: { date: true, checkIn: true, checkOut: true, user: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 40,
    });
    return {
      title: "Attendance Report",
      meta: { start, end, employeeId, departmentId, projectId },
      headers: ["date", "employee", "checkIn", "checkOut"],
      rows: records.map((r) => ({
        date: new Date(r.date).toISOString().slice(0, 10),
        employee: r.user?.name ?? "—",
        checkIn: new Date(r.checkIn).toISOString(),
        checkOut: r.checkOut ? new Date(r.checkOut).toISOString() : "",
      })),
      note: "This PDF lists recent entries. Use CSV for totals and ranking.",
    };
  }

  return null;
}

export async function buildPdfResponse(req, res) {
  const payload = await buildRowsForReport(req);
  if (!payload) {
    res.status(400).json({ error: "Unknown report type" });
    return;
  }

  const reportKey = String(req.query.report ?? "report").trim() || "report";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="report-${reportKey}.pdf"`);

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  doc.pipe(res);

  doc.font("Helvetica-Bold").fontSize(18).text(payload.title);
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(10).fillColor("#334155").text("Generated by Planitt CRM Analytics / Reports");
  doc.fillColor("black");
  doc.moveDown(0.8);

  const { start, end, employeeId, departmentId, projectId } = payload.meta ?? {};
  drawKeyValue(doc, "Range", `${String(start).slice(0, 10)} → ${String(end).slice(0, 10)}`);
  drawKeyValue(doc, "Employee", employeeId || "All");
  drawKeyValue(doc, "Department", departmentId || "All");
  drawKeyValue(doc, "Project", projectId || "All");

  if (payload.note) {
    doc.moveDown(0.6);
    doc.font("Helvetica-Oblique").fontSize(9).fillColor("#475569").text(payload.note);
    doc.fillColor("black");
  }

  doc.moveDown(1.0);
  drawTable(doc, payload.headers, payload.rows);

  doc.end();
}

