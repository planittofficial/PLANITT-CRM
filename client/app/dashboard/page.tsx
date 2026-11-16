"use client";

import { useEffect, useMemo, useState } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { AttendanceCard } from "@/components/modules/attendance-card";
import { StatePanel } from "@/components/shared/state-panel";
import { renderSessionGate } from "@/components/shared/session-gate";
import { Surface, buildLinePath, SummaryStatCard, LineChartCard, ActivityBarsCard, InsightTicker, PerformanceBars, HeatmapGrid, formatRole } from "@/components/dashboard/chart-widgets";
import { GoogleWorkspacePanel } from "@/components/dashboard/google-workspace-panel";
import { TaskSummaryList } from "@/components/dashboard/data-panels";
import { useCrmSearch } from "@/components/providers/crm-search-provider";
import { Skeleton } from "@/components/shared/skeleton";
import { canUseGoogleWorkspace, useDashboardData } from "@/hooks/use-dashboard-data";
import { apiGet } from "@/lib/api";
import type { EmployeeDashboardSummary, UserAnalyticsSummary } from "@/types/crm";

export default function DashboardPage() {
  const { globalSearch, searchSubmitted } = useCrmSearch();
  const {
    user, loading, error, sessionError, retrySession, summary,
    overviewStats, leadershipView,
    workspaceStatus, workspaceProjects,
    workspaceUsers, selectedWorkspaceProjectId, workspaceActionLoading, meetResult, sheetResult,
    driveResult, workspaceLoading, workspaceMessage, activeDashboardTab, setActiveDashboardTab,
    setMeetResult, setSheetResult, setDriveResult, setSelectedWorkspaceProjectId, setWorkspaceMessage,
    handleGoogleConnect, handleGoogleDisconnect, runWorkspaceAction,
  } = useDashboardData();

  const [myAnalytics, setMyAnalytics] = useState<UserAnalyticsSummary | null>(null);
  const [myAnalyticsLoading, setMyAnalyticsLoading] = useState(false);

  const myAttendanceHeatmap = useMemo(() => {
    if (!summary) return [];
    if (summary.scope === "employee") return summary.analytics.attendanceHeatmap;
    return myAnalytics?.analytics.attendanceHeatmap ?? [];
  }, [summary, myAnalytics]);

  useEffect(() => {
    if (!user || !summary) return;
    if (summary.scope === "employee") return;

    const userId = user.id;
    let cancelled = false;
    async function loadMine() {
      setMyAnalyticsLoading(true);
      try {
        const data = await apiGet<UserAnalyticsSummary>(`/users/${userId}/analytics`);
        if (!cancelled) setMyAnalytics(data);
      } catch {
        if (!cancelled) setMyAnalytics(null);
      } finally {
        if (!cancelled) setMyAnalyticsLoading(false);
      }
    }
    void loadMine();
    return () => {
      cancelled = true;
    };
  }, [user, summary]);

  useEffect(() => {
    if (!searchSubmitted) return;
    const q = globalSearch.trim().toLowerCase();
    if (!q) return;

    const jump = (id: string) => {
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    };

    if (q.includes("attendance") || q.includes("attendence")) {
      setActiveDashboardTab("analytics");
      jump("overview-section");
      return;
    }
    if (q.includes("team") || q.includes("member")) {
      setActiveDashboardTab("analytics");
      jump("overview-section");
      return;
    }
    if (q.includes("analytics") || q.includes("overview") || q.includes("metrics")) {
      setActiveDashboardTab("analytics");
      jump("overview-section");
      return;
    }
    if (q.includes("workspace") || q.includes("google") || q.includes("meet") || q.includes("sheet") || q.includes("drive")) {
      setActiveDashboardTab("workspace");
      jump("workspace-section");
    }
  }, [globalSearch, searchSubmitted, setActiveDashboardTab]);

  const sessionGate = renderSessionGate({ loading, user, error: sessionError, retry: retrySession, loadingTitle: "Loading workspace", loadingDescription: "Preparing your CRM dashboard." });
  if (sessionGate) return sessionGate;
  if (!user) return null;

  if (!summary) {

  return (

    <CRMShell user={user}>

      <div className="space-y-4 p-4">

        <Skeleton className="h-40 w-full" />

        <Skeleton className="h-64 w-full" />

        <Skeleton className="h-64 w-full" />

      </div>

    </CRMShell>

  );

}

  if (error ) {
    return (
      <CRMShell user={user}>
        <StatePanel title="Dashboard unavailable" description={error || "No summary data returned yet."} />
      </CRMShell>
    );
  }

  const completionRate = summary.scope === "employee"
    ? Math.round((((summary as EmployeeDashboardSummary).metrics.completedTasks || 0) / Math.max(1, (summary as EmployeeDashboardSummary).metrics.myTasks)) * 100)
    : Math.round((summary.metrics.completedTasks / Math.max(1, summary.metrics.totalTasks)) * 100);
  const currentUserCheckedIn = summary.scope === "employee"
    ? (summary as EmployeeDashboardSummary).metrics.checkedIn
    : summary.metrics.checkedIn;
  const heroHoursValue = summary.analytics.workingHoursTrend.at(-1)?.hours ?? 0;
  const totalWorkforce = summary.scope === "employee" ? 1 : summary.metrics.totalEmployees + summary.metrics.totalInterns;
  const activeAttendance = summary.scope === "employee" ? ((summary as EmployeeDashboardSummary).metrics.checkedIn ? 1 : 0) : summary.metrics.activeAttendance;
  const attendanceRate = Math.round((activeAttendance / Math.max(1, totalWorkforce)) * 100);
  const latestProgress = summary.analytics.taskProgressTrend.at(-1)?.avgProgress ?? 0;
  const previousProgress = summary.analytics.taskProgressTrend.length > 1 ? (summary.analytics.taskProgressTrend.at(-2)?.avgProgress ?? latestProgress) : latestProgress;
  const progressDelta = Math.round((latestProgress - previousProgress) * 10) / 10;
  const totalTasks = summary.scope === "employee" ? (summary as EmployeeDashboardSummary).metrics.myTasks : summary.metrics.totalTasks;
  const completedTasks = summary.metrics.completedTasks;
  const movingAvg = (() => { const t = summary.analytics.taskProgressTrend; if (!t.length) return 0; const w = t.slice(-5); return Math.max(0, w.reduce((s, x) => s + x.completed, 0) / w.length); })();
  const forecastCompleted = Math.round(completedTasks + movingAvg);
  const forecastCompletionRate = Math.round((forecastCompleted / Math.max(1, totalTasks)) * 100);
  const recentTrend = summary.analytics.taskProgressTrend.slice(-7);
  const insightItems = [
    { label: "Execution pace", value: progressDelta > 0 ? `Up ${Math.abs(progressDelta)}% vs last day` : progressDelta < 0 ? `Down ${Math.abs(progressDelta)}% vs last day` : "Stable vs last day", tone: (progressDelta > 0 ? "positive" : progressDelta < 0 ? "warning" : "neutral") as "neutral" | "positive" | "warning" },
    { label: "Attendance pulse", value: `${attendanceRate}% live participation`, tone: (attendanceRate >= 75 ? "positive" : attendanceRate <= 55 ? "warning" : "neutral") as "neutral" | "positive" | "warning" },
    { label: "Throughput forecast", value: `${forecastCompleted} completed by next week`, tone: (forecastCompletionRate >= completionRate ? "positive" : "neutral") as "neutral" | "positive" | "warning" },
  ];

  if (summary.scope === "employee") {
    const employeeSummary = summary as EmployeeDashboardSummary;
    return (
      <CRMShell user={user}>
        <div className="space-y-4">
          {/* Teams Header Banner */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-[var(--accent)] border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                    {formatRole(user.role)}
                  </span>
                  <span className="text-xs text-[var(--text-soft)]">Personal Workspace</span>
                </div>
                <h1 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl">
                  Welcome back, {user.name.split(" ")[0]}
                </h1>
                <p className="mt-0.5 text-xs text-[var(--text-soft)]">
                  Your work summary and daily attendance status.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-center min-w-[70px]">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
                    My Tasks
                  </p>
                  <p className="text-base font-bold text-[var(--text-main)]">{employeeSummary.metrics.myTasks}</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-center min-w-[70px]">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
                    Completion
                  </p>
                  <p className="text-base font-bold text-emerald-600">{completionRate}%</p>
                </div>
              </div>
            </div>
          </div>

          <AttendanceCard initialCheckedIn={employeeSummary.metrics.checkedIn} />

          <Surface className="p-4 sm:p-5">
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-[var(--text-main)]">Recent Tasks</h4>
              <p className="mt-0.5 text-xs text-[var(--text-soft)]">Your latest assigned work items.</p>
            </div>
            {employeeSummary.recentTasks.length ? (
              <TaskSummaryList tasks={employeeSummary.recentTasks} />
            ) : (
              <StatePanel title="No tasks yet" description="No assigned tasks found for your account." />
            )}
          </Surface>
        </div>
      </CRMShell>
    );
  }

  return (
    <CRMShell user={user}>
      <div className="space-y-4">
        {/* Teams Header Banner */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-[var(--accent)] border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                  {formatRole(user.role)}
                </span>
                <span className="text-xs text-[var(--text-soft)]">
                  {summary.scope === "superadmin"
                    ? "Executive Overview"
                    : summary.scope === "admin"
                    ? "Admin Dashboard"
                    : "Team Overview"}
                </span>
              </div>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl">
                Welcome back, {user.name.split(" ")[0]}
              </h1>
              <p className="mt-0.5 text-xs text-[var(--text-soft)]">
                {leadershipView
                  ? "Track overall team progress, task delivery, and operational health."
                  : "Track daily attendance, assigned deliverables, and workload progress."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-center min-w-[70px]">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
                  Completion
                </p>
                <p className="text-base font-bold text-emerald-600">{completionRate}%</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-center min-w-[70px]">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
                  Work Hours
                </p>
                <p className="text-base font-bold text-[var(--text-main)]">{heroHoursValue}h</p>
              </div>
            </div>
          </div>
        </div>

        <AttendanceCard initialCheckedIn={currentUserCheckedIn} />

        {/* Teams Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--border)] pb-1">
          {(["analytics", "workspace"] as const).map((tab) => {
            const isActive = activeDashboardTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveDashboardTab(tab)}
                className={`relative px-4 py-2 text-xs font-semibold transition-colors ${
                  isActive
                    ? "text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-[5px]"
                    : "text-[var(--text-soft)] hover:text-[var(--text-main)]"
                }`}
              >
                {tab === "analytics" ? "Analytics & Overview" : "Google Workspace"}
              </button>
            );
          })}
        </div>

        {activeDashboardTab === "analytics" ? (
          <>
            <section className="space-y-4" id="overview-section">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-main)]">Core Performance Metrics</h3>
                  <p className="text-xs text-[var(--text-soft)]">Real-time statistics across active projects and team members</p>
                </div>
              </div>

              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {overviewStats.map((stat) => (
                  <SummaryStatCard
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    helper={stat.helper}
                    points={stat.points}
                  />
                ))}
              </section>

              <InsightTicker items={insightItems} />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <LineChartCard
                  title="Personal Work-Hour Trend"
                  subtitle="Daily logged hours across recent dates."
                  values={summary.analytics.workingHoursTrend.map((x) => x.hours)}
                  labels={summary.analytics.workingHoursTrend.map((x) => x.label)}
                  suffix="h"
                  stroke="var(--accent)"
                />
                <LineChartCard
                  title="Task Progress Momentum"
                  subtitle="Average completion velocity across active tasks."
                  values={summary.analytics.taskProgressTrend.map((x) => x.avgProgress)}
                  labels={summary.analytics.taskProgressTrend.map((x) => x.label)}
                  suffix="%"
                  stroke="#107c41"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ActivityBarsCard
                  title="Created vs Completed Workload"
                  subtitle="Daily task creation volume compared with completed tasks."
                  labels={recentTrend.map((x) => x.label)}
                  createdValues={recentTrend.map((x) => x.created)}
                  completedValues={recentTrend.map((x) => x.completed)}
                />
                <PerformanceBars
                  title="Operational Indicators"
                  subtitle="Key delivery and team availability health markers."
                  items={[
                    {
                      label: "Task completion quality",
                      value: completionRate,
                      helper: "Share of tasks reaching done state",
                    },
                    {
                      label: "Live team availability",
                      value: attendanceRate,
                      helper: "Currently checked-in team members",
                    },
                    {
                      label: "Momentum health",
                      value: Math.max(0, Math.min(100, 50 + Math.round(progressDelta * 5))),
                      helper: "Trend-adjusted execution pulse",
                    },
                  ]}
                />
              </div>
            </section>

            <section className="space-y-4" id="analytics-section">
              {myAnalyticsLoading ? (
                <StatePanel
                  title="Loading attendance heatmap"
                  description="Preparing attendance records..."
                />
              ) : myAttendanceHeatmap.length ? (
                <HeatmapGrid
                  title="Attendance Activity Calendar"
                  subtitle="Daily attendance frequency over recent weeks."
                  items={myAttendanceHeatmap}
                />
              ) : (
                <StatePanel
                  title="No attendance yet"
                  description="No attendance history found for your account in this period."
                />
              )}
            </section>
          </>
        ) : (
          <section className="space-y-4" id="workspace-section">
            <div>
              <h3 className="text-base font-semibold text-[var(--text-main)]">Connected Google Workspace</h3>
              <p className="text-xs text-[var(--text-soft)]">
                Manage integrated Google Meet sessions, Sheets, and Drive attachments.
              </p>
            </div>
            {canUseGoogleWorkspace(summary.scope) ? (
              <GoogleWorkspacePanel
                scope={summary.scope}
                status={workspaceStatus}
                loading={workspaceLoading}
                message={workspaceMessage}
                projects={workspaceProjects}
                users={workspaceUsers}
                selectedProjectId={selectedWorkspaceProjectId}
                actionLoading={workspaceActionLoading}
                meetResult={meetResult}
                sheetResult={sheetResult}
                driveResult={driveResult}
                onClearMeetResult={() => setMeetResult(null)}
                onClearSheetResult={() => setSheetResult(null)}
                onClearDriveResult={() => setDriveResult(null)}
                onSelectProject={setSelectedWorkspaceProjectId}
                onConnect={() => void handleGoogleConnect()}
                onDisconnect={() => void handleGoogleDisconnect()}
                onCreateMeet={(ids) => void runWorkspaceAction("meet", ids)}
                onCreateSheet={() => void runWorkspaceAction("sheets")}
                onCreateDriveFolder={() => void runWorkspaceAction("drive")}
                onSetMessage={setWorkspaceMessage}
              />
            ) : (
              <StatePanel
                title="Google Workspace unavailable"
                description="Only admin and superadmin accounts can use this tab."
              />
            )}
          </section>
        )}
      </div>
    </CRMShell>
  );
}
