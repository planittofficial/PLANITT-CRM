"use client";

import { useEffect, useMemo, useState } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { StatePanel } from "@/components/shared/state-panel";
import { renderSessionGate } from "@/components/shared/session-gate";
import { Surface, LineChartCard, ActivityBarsCard } from "@/components/dashboard/chart-widgets";
import { DonutChartCard, MilestoneCard, StatusBreakdownCard } from "@/components/dashboard/data-panels";
import { useSession } from "@/hooks/use-session";
import { apiGet, resolveApiBaseUrl } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { showToast } from "@/hooks/use-toast";
import { AnalyticsSkeleton } from "@/components/shared/skeleton";
import type { CRMUser, Department, Project, UserAnalyticsSummary } from "@/types/crm";

type ReportTab =
  | "executive"
  | "employee"
  | "department"
  | "attendance"
  | "project"
  | "taskSla"
  | "leave";

type ExecutiveReport = {
  range: { start: string; end: string };
  filters: { employeeId: string | null; departmentId: string | null; projectId: string | null };
  kpis: {
    employeeCount: number;
    internCount: number;
    departmentCount: number;
    projectCount: number;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    completionRate: number;
    attendanceEntries: number;
    avgDailyHours: number;
  };
  charts: {
    workingHoursTrend: Array<{ date: string; label: string; hours: number }>;
    taskProgressTrend: Array<{ date: string; label: string; created: number; completed: number; avgProgress: number }>;
    projectsCreatedByDay: Array<{ date: string; label: string; value: number }>;
  };
};

type AttendanceReport = {
  range: { start: string; end: string };
  filters: { employeeId: string | null; departmentId: string | null };
  kpis: { totalEntries: number; totalHours: number; uniqueEmployees: number };
  charts: { workingHoursTrend: Array<{ date: string; label: string; hours: number }> };
  tables: { topEmployees: Array<{ userId: string; name: string; role: string; totalHours: number; attendanceDays: number }> };
};

type DepartmentReport = {
  range: { start: string; end: string };
  filters: { departmentId: string | null };
  rows: Array<{
    departmentId: string;
    departmentName: string;
    departmentCode: string;
    members: number;
    managers: number;
    interns: number;
    totalProjects: number;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    avgProgress: number;
  }>;
};

type ProjectReport = {
  range: { start: string; end: string };
  filters: { projectId: string | null; departmentId: string | null };
  rows: Array<{
    projectId: string;
    projectName: string;
    departmentId: string;
    totalTasks: number;
    todo: number;
    inProgress: number;
    done: number;
    completionRate: number;
    avgProgress: number;
    overdueTasks: number;
  }>;
};

type TaskSlaReport = {
  range: { start: string; end: string };
  filters: { employeeId: string | null; departmentId: string | null; projectId: string | null };
  kpis: { tasksWithDeadline: number; overdueOpen: number; completedOnTime: number; completedLate: number; onTimeRate: number };
  rows: Array<{
    taskId: string;
    title: string;
    status: string;
    progress: number;
    deadlineAt: string | null;
    updatedAt: string;
    projectName: string;
    assignees: string[];
    isOverdue: boolean;
    completedLate: boolean;
  }>;
};

type LeaveReport = {
  range: { start: string; end: string };
  filters: { employeeId: string | null; departmentId: string | null };
  kpis: { totalRequests: number };
  charts: { statusBreakdown: Array<{ label: string; value: number }>; typeBreakdown: Array<{ label: string; value: number }> };
  rows: Array<{
    id: string;
    employeeName: string;
    role: string;
    status: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    requestedAt: string;
  }>;
};

function isoDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

const FILTER_FIELD_STYLE = {
  borderColor: "var(--border)",
  background: "var(--surface)",
  color: "var(--text-main)",
} as const;

function buildQuery(params: Record<string, string | null | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    qs.set(k, v);
  }
  const out = qs.toString();
  return out ? `?${out}` : "";
}

async function downloadFile(path: string, filename: string) {
  const token = getToken();
  const url = `${resolveApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    const message = `Export failed (${res.status})`;
    throw new Error(message);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function SimpleTable({ title, subtitle, columns, rows }: { title: string; subtitle: string; columns: Array<{ key: string; label: string }>; rows: Array<Record<string, unknown>> }) {
  return (
    <Surface className="p-4 sm:p-5">
      <h4 className="text-sm font-semibold text-[var(--text-main)]">{title}</h4>
      <p className="mt-0.5 text-xs text-[var(--text-soft)]">{subtitle}</p>

      {/* Mobile Card Layout */}
      <div className="mt-3.5 space-y-2.5 lg:hidden">
        {rows.length ? (
          rows.map((row, idx) => (
            <article
              key={idx}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 shadow-xs"
            >
              <div className="space-y-1.5 divide-y divide-[var(--border)]">
                {columns.map((column, colIdx) => (
                  <div key={column.key} className={`flex items-center justify-between gap-2 text-xs ${colIdx > 0 ? "pt-1.5" : ""}`}>
                    <span className="text-[var(--text-soft)] font-medium">
                      {column.label}
                    </span>
                    <span className={`text-right font-semibold text-[var(--text-main)] truncate max-w-[65%]`}>
                      {String(row[column.key] ?? "—")}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--text-soft)]">
            No data available for the selected filters.
          </p>
        )}
      </div>

      {/* Desktop & Tablet Table Layout */}
      <div className="mt-3.5 hidden overflow-x-auto rounded-lg border border-[var(--border)] lg:block crm-table-scroll">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-[var(--surface-soft)] border-b border-[var(--border)]">
            <tr className="font-semibold text-[var(--text-soft)]">
              {columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3.5 py-2.5">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)] text-[var(--text-main)]">
            {rows.map((r, idx) => (
              <tr key={idx} className="hover:bg-[var(--surface-soft)] transition-colors">
                {columns.map((c, colIdx) => (
                  <td
                    key={`${idx}-${c.key}`}
                    className="whitespace-nowrap px-3.5 py-2.5"
                  >
                    <span className={colIdx === 0 ? "font-semibold text-[var(--text-main)]" : "text-[var(--text-soft)]"}>
                      {String(r[c.key] ?? "—")}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

export default function AnalyticsPage() {
  const { user, loading, error: sessionError, retry: retrySession } = useSession();
  const isLeadership =
    user?.role === "SUPERADMIN" || user?.role === "ADMIN" || user?.role === "MANAGER";

  const [tab, setTab] = useState<ReportTab>("executive");
  const [startDate, setStartDate] = useState(() => isoDay(new Date(Date.now() - 13 * 24 * 60 * 60 * 1000)));
  const [endDate, setEndDate] = useState(() => isoDay(new Date()));
  const [employeeId, setEmployeeId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");

  const [employees, setEmployees] = useState<CRMUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [loadingPickers, setLoadingPickers] = useState(true);
  const [loadingReport, setLoadingReport] = useState(true);
  const [reportError, setReportError] = useState("");
  const [executive, setExecutive] = useState<ExecutiveReport | null>(null);
  const [attendance, setAttendance] = useState<AttendanceReport | null>(null);
  const [deptReport, setDeptReport] = useState<DepartmentReport | null>(null);
  const [projectReport, setProjectReport] = useState<ProjectReport | null>(null);
  const [taskSla, setTaskSla] = useState<TaskSlaReport | null>(null);
  const [leaveReport, setLeaveReport] = useState<LeaveReport | null>(null);
  const [employeeAnalytics, setEmployeeAnalytics] = useState<UserAnalyticsSummary | null>(null);

  useEffect(() => {
    if (!isLeadership) {
      setLoadingPickers(false);
      return;
    }

    let cancelled = false;
    async function loadPickers() {
      setLoadingPickers(true);
      try {
        const [employeeDirectory, deps, projs] = await Promise.all([
          apiGet<{ users: CRMUser[] }>("/reports/employees"),
          apiGet<Department[]>("/departments"),
          apiGet<Project[]>("/projects"),
        ]);
        if (cancelled) return;
        setEmployees(employeeDirectory.users);
        setDepartments(deps);
        setProjects(projs);
      } catch {
        if (cancelled) return;
        setEmployees([]);
        setDepartments([]);
        setProjects([]);
      } finally {
        if (!cancelled) setLoadingPickers(false);
      }
    }
    void loadPickers();
    return () => {
      cancelled = true;
    };
  }, [isLeadership]);

  const commonQuery = useMemo(
    () =>
      buildQuery({
        startDate,
        endDate,
        employeeId: employeeId || null,
        departmentId: departmentId || null,
        projectId: projectId || null,
      }),
    [startDate, endDate, employeeId, departmentId, projectId]
  );

  useEffect(() => {
    if (!isLeadership) return;

    let cancelled = false;
    async function loadReport() {
      setLoadingReport(true);
      setReportError("");
      try {
        if (tab === "executive") {
          const data = await apiGet<ExecutiveReport>(`/reports/executive${commonQuery}`);
          if (!cancelled) setExecutive(data);
        } else if (tab === "attendance") {
          const data = await apiGet<AttendanceReport>(`/reports/attendance${commonQuery}`);
          if (!cancelled) setAttendance(data);
        } else if (tab === "department") {
          const data = await apiGet<DepartmentReport>(
            `/reports/departments${buildQuery({ startDate, endDate, departmentId: departmentId || null })}`
          );
          if (!cancelled) setDeptReport(data);
        } else if (tab === "project") {
          const data = await apiGet<ProjectReport>(
            `/reports/projects${buildQuery({ startDate, endDate, projectId: projectId || null, departmentId: departmentId || null })}`
          );
          if (!cancelled) setProjectReport(data);
        } else if (tab === "taskSla") {
          const data = await apiGet<TaskSlaReport>(`/reports/task-sla${commonQuery}`);
          if (!cancelled) setTaskSla(data);
        } else if (tab === "leave") {
          const data = await apiGet<LeaveReport>(
            `/reports/leaves${buildQuery({ startDate, endDate, employeeId: employeeId || null, departmentId: departmentId || null })}`
          );
          if (!cancelled) setLeaveReport(data);
        } else if (tab === "employee") {
          if (!employeeId) {
            if (!cancelled) {
              setEmployeeAnalytics(null);
              setLoadingReport(false);
            }
            return;
          }
          const data = await apiGet<UserAnalyticsSummary>(
            `/users/${employeeId}/analytics${buildQuery({ startDate, endDate })}`
          );
          if (!cancelled) setEmployeeAnalytics(data);
        }
      } catch (err) {
        if (cancelled) return;
        setReportError(err instanceof Error ? err.message : "Unable to load report");
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    }
    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [isLeadership, tab, commonQuery, startDate, endDate, employeeId, departmentId, projectId]);

  const exportParams = useMemo(() => {
    const base = { startDate, endDate };
    if (tab === "department") return { ...base, report: "departments", departmentId: departmentId || undefined };
    if (tab === "project") return { ...base, report: "projects", projectId: projectId || undefined, departmentId: departmentId || undefined };
    if (tab === "attendance") return { ...base, report: "attendance", employeeId: employeeId || undefined, departmentId: departmentId || undefined };
    if (tab === "taskSla") return { ...base, report: "task-sla", employeeId: employeeId || undefined, departmentId: departmentId || undefined, projectId: projectId || undefined };
    if (tab === "leave") return { ...base, report: "leaves", employeeId: employeeId || undefined, departmentId: departmentId || undefined };
    return null;
  }, [tab, startDate, endDate, employeeId, departmentId, projectId]);

  const exportButtonsEnabled = Boolean(exportParams);
  const showReportLoading = loadingReport || loadingPickers;
  const showEmployeePrompt = tab === "employee" && !employeeId && !showReportLoading;

  const handleExport = async (format: "csv" | "pdf") => {
    if (!exportParams) return;
    try {
      setLoadingReport(true);
      const q = buildQuery(exportParams as Record<string, string>);
      const path = `/reports/export.${format}${q}`;
      const filename = `planitt-${exportParams.report}-${startDate}-to-${endDate}.${format}`;
      await downloadFile(path, filename);
      showToast(`${format.toUpperCase()} export downloaded.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setLoadingReport(false);
    }
  };

  const sessionGate = renderSessionGate({
    loading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading analytics",
    loadingDescription: "Preparing management reports.",
  });
  if (sessionGate) return sessionGate;
  if (!user) return null;

  if (!isLeadership) {
    return (
      <CRMShell user={user}>
        <StatePanel
          title="Access restricted"
          description="Analytics & Reports is only available to Super Admin, Admin, and Manager accounts."
        />
      </CRMShell>
    );
  }

  return (
    <CRMShell user={user}>
      <div className="min-w-0 space-y-3 sm:space-y-4">
        <Surface className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-[var(--accent)] border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                  Reports
                </span>
                <span className="text-xs text-[var(--text-soft)]">System Intelligence</span>
              </div>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl">
                Analytics & Reports
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-soft)]">
                Filter by employee, department, project, and date range. Export reports in CSV or PDF.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
                disabled={!exportButtonsEnabled || loadingReport}
                onClick={() => void handleExport("csv")}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-50"
                disabled={!exportButtonsEnabled || loadingReport}
                onClick={() => void handleExport("pdf")}
              >
                Export PDF
              </button>
            </div>
          </div>

          {/* Clean Teams-style Filter Toolbar */}
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5 border-t border-[var(--border)] pt-4">
            <div>
              <label className="text-[11px] font-medium text-[var(--text-soft)] mb-1 block">Start date</label>
              <input
                className="h-8.5 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--text-soft)] mb-1 block">End date</label>
              <input
                className="h-8.5 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--text-soft)] mb-1 block">Employee</label>
              <select
                className="h-8.5 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">All Employees</option>
                {employees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--text-soft)] mb-1 block">Department</label>
              <select
                className="h-8.5 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--text-soft)] mb-1 block">Project</label>
              <select
                className="h-8.5 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Surface>

        {/* Clean Segmented Tab Strip */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border)] pb-1">
          {([
            ["executive", "Executive Overview"],
            ["employee", "Individual Performance"],
            ["department", "Department Metrics"],
            ["attendance", "Attendance Logs"],
            ["project", "Project Delivery"],
            ["taskSla", "Task SLA & Deadlines"],
            ["leave", "Leave Breakdown"],
          ] as Array<[ReportTab, string]>).map(([key, label]) => {
            const isActive = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`whitespace-nowrap px-3.5 py-2 text-xs font-semibold transition-colors ${
                  isActive
                    ? "text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-[5px]"
                    : "text-[var(--text-soft)] hover:text-[var(--text-main)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {reportError ? <StatePanel title="Report unavailable" description={reportError} /> : null}

        {showReportLoading ? <AnalyticsSkeleton /> : null}

        {!showReportLoading && tab === "executive" && executive ? (
          <div className="space-y-3 sm:space-y-4">
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              <MilestoneCard title="Employees" value={`${executive.kpis.employeeCount}`} helper="Total active employees + leadership roles" />
              <MilestoneCard title="Interns" value={`${executive.kpis.internCount}`} helper="Total intern workforce" />
              <MilestoneCard title="Projects" value={`${executive.kpis.projectCount}`} helper="All projects in the system" />
              <MilestoneCard title="Task completion" value={`${executive.kpis.completionRate}%`} helper={`${executive.kpis.completedTasks}/${executive.kpis.totalTasks} completed in range`} />
            </section>
            <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
              <LineChartCard
                title="Working hours trend"
                subtitle="Average working hours across selected scope."
                values={executive.charts.workingHoursTrend.map((x) => x.hours)}
                labels={executive.charts.workingHoursTrend.map((x) => x.label)}
                suffix="h"
                stroke="var(--accent)"
                fill="color-mix(in srgb, var(--accent) 14%, transparent)"
              />
              <LineChartCard
                title="Progress trend"
                subtitle="Daily average progress across updated tasks."
                values={executive.charts.taskProgressTrend.map((x) => x.avgProgress)}
                labels={executive.charts.taskProgressTrend.map((x) => x.label)}
                suffix="%"
                stroke="var(--success)"
                fill="color-mix(in srgb, var(--success) 12%, transparent)"
              />
            </div>
            <ActivityBarsCard
              title="Created vs completed"
              subtitle="Daily creation volume compared to completions."
              labels={executive.charts.taskProgressTrend.map((x) => x.label)}
              createdValues={executive.charts.taskProgressTrend.map((x) => x.created)}
              completedValues={executive.charts.taskProgressTrend.map((x) => x.completed)}
            />
          </div>
        ) : null}

        {!showReportLoading && tab === "department" && deptReport ? (
          <SimpleTable
            title="Department performance"
            subtitle="Members, project load, and task delivery across departments."
            columns={[
              { key: "departmentName", label: "Department" },
              { key: "members", label: "Members" },
              { key: "totalProjects", label: "Projects" },
              { key: "totalTasks", label: "Tasks" },
              { key: "completedTasks", label: "Done" },
              { key: "completionRate", label: "Completion" },
              { key: "avgProgress", label: "Avg progress" },
            ]}
            rows={deptReport.rows.map((r) => ({
              departmentName: r.departmentName,
              members: r.members,
              totalProjects: r.totalProjects,
              totalTasks: r.totalTasks,
              completedTasks: r.completedTasks,
              completionRate: `${r.completionRate}%`,
              avgProgress: `${r.avgProgress}%`,
            }))}
          />
        ) : null}

        {!showReportLoading && tab === "project" && projectReport ? (
          <SimpleTable
            title="Project health"
            subtitle="Task flow and delivery confidence at project-level."
            columns={[
              { key: "projectName", label: "Project" },
              { key: "totalTasks", label: "Tasks" },
              { key: "done", label: "Done" },
              { key: "completionRate", label: "Completion" },
              { key: "avgProgress", label: "Avg progress" },
              { key: "overdueTasks", label: "Overdue" },
            ]}
            rows={projectReport.rows.map((r) => ({
              projectName: r.projectName,
              totalTasks: r.totalTasks,
              done: r.done,
              completionRate: `${r.completionRate}%`,
              avgProgress: `${r.avgProgress}%`,
              overdueTasks: r.overdueTasks,
            }))}
          />
        ) : null}

        {!showReportLoading && tab === "attendance" && attendance ? (
          <div className="space-y-3 sm:space-y-4">
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
              <MilestoneCard title="Entries" value={`${attendance.kpis.totalEntries}`} helper="Attendance rows in selected range" />
              <MilestoneCard title="Total hours" value={`${attendance.kpis.totalHours}h`} helper="Sum of check-in/out hours" />
              <MilestoneCard title="Unique employees" value={`${attendance.kpis.uniqueEmployees}`} helper="Distinct users with entries" />
            </section>
            <LineChartCard
              title="Working hours trend"
              subtitle="Average hours per day in selected scope."
              values={attendance.charts.workingHoursTrend.map((x) => x.hours)}
              labels={attendance.charts.workingHoursTrend.map((x) => x.label)}
              suffix="h"
              stroke="var(--accent)"
              fill="color-mix(in srgb, var(--accent) 14%, transparent)"
            />
            <SimpleTable
              title="Top employees by hours"
              subtitle="Most active contributors by logged hours."
              columns={[
                { key: "name", label: "Employee" },
                { key: "role", label: "Role" },
                { key: "totalHours", label: "Hours" },
                { key: "attendanceDays", label: "Days" },
              ]}
              rows={attendance.tables.topEmployees.map((x) => ({
                name: x.name,
                role: x.role,
                totalHours: x.totalHours,
                attendanceDays: x.attendanceDays,
              }))}
            />
          </div>
        ) : null}

        {!showReportLoading && tab === "taskSla" && taskSla ? (
          <div className="space-y-3 sm:space-y-4">
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              <MilestoneCard title="Tasks w/ deadline" value={`${taskSla.kpis.tasksWithDeadline}`} helper="Deadline-tracked tasks in scope" />
              <MilestoneCard title="Overdue open" value={`${taskSla.kpis.overdueOpen}`} helper="Open tasks past deadline" />
              <MilestoneCard title="On-time rate" value={`${taskSla.kpis.onTimeRate}%`} helper="Completed tasks on-time vs late" />
              <MilestoneCard title="Completed late" value={`${taskSla.kpis.completedLate}`} helper="Completed after deadline" />
            </section>
            <StatusBreakdownCard
              title="SLA outcome split"
              items={[
                { label: "Completed on time", value: taskSla.kpis.completedOnTime },
                { label: "Completed late", value: taskSla.kpis.completedLate },
                { label: "Overdue open", value: taskSla.kpis.overdueOpen },
              ]}
            />
            <SimpleTable
              title="Recent deadline tasks"
              subtitle="Latest deadline-tracked tasks (snapshot). Export CSV for full list."
              columns={[
                { key: "title", label: "Task" },
                { key: "projectName", label: "Project" },
                { key: "status", label: "Status" },
                { key: "progress", label: "Progress" },
                { key: "deadlineAt", label: "Deadline" },
                { key: "isOverdue", label: "Overdue" },
              ]}
              rows={taskSla.rows.slice(0, 20).map((r) => ({
                title: r.title,
                projectName: r.projectName,
                status: r.status,
                progress: `${r.progress}%`,
                deadlineAt: r.deadlineAt ? r.deadlineAt.slice(0, 10) : "—",
                isOverdue: r.isOverdue ? "Yes" : "No",
              }))}
            />
          </div>
        ) : null}

        {!showReportLoading && tab === "leave" && leaveReport ? (
          <div className="space-y-3 sm:space-y-4">
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              <MilestoneCard title="Requests" value={`${leaveReport.kpis.totalRequests}`} helper="Total leave requests in range" />
              <MilestoneCard title="Approved" value={`${leaveReport.charts.statusBreakdown.find((x) => x.label === "APPROVED")?.value ?? 0}`} helper="Approved leaves" />
              <MilestoneCard title="Pending" value={`${leaveReport.charts.statusBreakdown.find((x) => x.label === "PENDING")?.value ?? 0}`} helper="Pending approvals" />
              <MilestoneCard title="Rejected" value={`${leaveReport.charts.statusBreakdown.find((x) => x.label === "REJECTED")?.value ?? 0}`} helper="Rejected requests" />
            </section>
            <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
              <DonutChartCard
                title="By status"
                subtitle="Leave request outcomes."
                items={leaveReport.charts.statusBreakdown.map((x, idx) => ({
                  label: x.label,
                  value: x.value,
                  color: idx === 0 ? "var(--accent)" : idx === 1 ? "var(--success)" : "var(--text-faint)",
                }))}
              />
              <DonutChartCard
                title="By leave type"
                subtitle="Patterns across leave categories."
                items={leaveReport.charts.typeBreakdown.map((x, idx) => ({
                  label: x.label,
                  value: x.value,
                  color: idx % 2 === 0 ? "var(--accent)" : "var(--success)",
                }))}
              />
            </div>
            <SimpleTable
              title="Recent leave requests"
              subtitle="Latest leave requests (snapshot). Export CSV/PDF for distribution."
              columns={[
                { key: "employeeName", label: "Employee" },
                { key: "leaveType", label: "Type" },
                { key: "status", label: "Status" },
                { key: "startDate", label: "Start" },
                { key: "endDate", label: "End" },
              ]}
              rows={leaveReport.rows.slice(0, 20).map((r) => ({
                employeeName: r.employeeName,
                leaveType: r.leaveType,
                status: r.status,
                startDate: r.startDate.slice(0, 10),
                endDate: r.endDate.slice(0, 10),
              }))}
            />
          </div>
        ) : null}

        {showEmployeePrompt ? (
          <StatePanel title="Employee report" description="Pick an employee from the filters above to load detailed performance analytics." />
        ) : null}

        {!showReportLoading && tab === "employee" && employeeId && employeeAnalytics ? (
            <div className="space-y-3 sm:space-y-4">
              <Surface className="p-3 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Selected employee</p>
                <h3 className="mt-2 text-xl font-semibold text-[var(--text-main)] sm:text-2xl">{employeeAnalytics.user.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                  {employeeAnalytics.user.designation || "Team member"} · {employeeAnalytics.user.role} ·{" "}
                  {employeeAnalytics.user.department?.name || "No department"}
                </p>
              </Surface>
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                <MilestoneCard title="Assigned tasks" value={`${employeeAnalytics.metrics.totalTasks}`} helper="Total tasks assigned" />
                <MilestoneCard title="Completed" value={`${employeeAnalytics.metrics.completedTasks}`} helper="Done tasks in scope" />
                <MilestoneCard title="Avg progress" value={`${employeeAnalytics.metrics.avgProgress}%`} helper="Average task progress" />
                <MilestoneCard title="Avg hours/day" value={`${employeeAnalytics.metrics.avgDailyHours}h`} helper="Average working hours per day" />
              </section>
              <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
                <LineChartCard
                  title="Daily work hours"
                  subtitle="Working-hour movement in the selected range."
                  values={employeeAnalytics.analytics.workingHoursTrend.map((x) => x.hours)}
                  labels={employeeAnalytics.analytics.workingHoursTrend.map((x) => x.label)}
                  suffix="h"
                  stroke="var(--accent)"
                  fill="color-mix(in srgb, var(--accent) 16%, transparent)"
                />
                <LineChartCard
                  title="Progress trend"
                  subtitle="Average progress movement over time."
                  values={employeeAnalytics.analytics.taskProgressTrend.map((x) => x.avgProgress)}
                  labels={employeeAnalytics.analytics.taskProgressTrend.map((x) => x.label)}
                  suffix="%"
                  stroke="var(--success)"
                  fill="color-mix(in srgb, var(--success) 12%, transparent)"
                />
              </div>
              <StatusBreakdownCard title="Task status split" items={employeeAnalytics.taskStatusBreakdown} />
            </div>
          ) : null}
      </div>
    </CRMShell>
  );
}

