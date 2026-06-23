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

    let cancelled = false;
    async function loadMine() {
      setMyAnalyticsLoading(true);
      try {
        const data = await apiGet<UserAnalyticsSummary>(`/users/${user.id}/analytics`);
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
          <Surface className="overflow-hidden p-0">
            <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
                  Personal dashboard
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]">
                  Welcome back, {user.name.split(" ")[0]}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
                  Your work summary and attendance status. Company analytics are available only to managers and admins.
                </p>
              </div>
              <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--surface)) 0%, var(--surface-soft) 100%)" }}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">My tasks</p>
                    <p className="mt-1 text-2xl font-semibold text-[var(--text-main)]">{employeeSummary.metrics.myTasks}</p>
                  </div>
                  <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">Completion</p>
                    <p className="mt-1 text-2xl font-semibold text-[var(--text-main)]">{completionRate}%</p>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <p className="text-sm font-semibold text-[var(--text-main)]">Momentum</p>
                  <div className="mt-2 h-20 overflow-hidden rounded-xl border p-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                    <svg viewBox="0 0 360 80" className="h-full w-full" aria-hidden="true">
                      <path d={buildLinePath(employeeSummary.analytics.taskProgressTrend.map((x) => x.avgProgress), 360, 80)} fill="none" stroke="var(--accent-strong)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </Surface>

          <AttendanceCard initialCheckedIn={employeeSummary.metrics.checkedIn} />

          <Surface className="p-5">
            <div className="mb-4">
              <p className="text-sm font-semibold text-[var(--text-main)]">Recent tasks</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">Your latest assigned work items.</p>
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
        <Surface className="overflow-hidden p-0">
          <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
                {summary.scope === "superadmin" ? "CEO command center" : summary.scope === "admin" ? "Admin command center" : "Personal command center"}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-main)] sm:text-3xl">Welcome back, {user.name.split(" ")[0]}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">{leadershipView ? "Track key team health and progress in one place." : "See your daily attendance, work hours, and progress quickly."}</p>
              <div className="mt-4 grid max-w-2xl gap-2 sm:grid-cols-2">
                <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Focus</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">My work</p>
                </div>
                <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Mode</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{formatRole(user.role)}</p>
                </div>
              </div>
            </div>
            <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--surface)) 0%, var(--surface-soft) 100%)" }}>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">Completion rate</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--text-main)]">{completionRate}%</p>
                </div>
                <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">Latest work hours</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--text-main)]">{heroHoursValue}h</p>
                </div>
              </div>
              <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <p className="text-sm font-semibold text-[var(--text-main)]">Momentum</p>
                <div className="mt-2 h-20 overflow-hidden rounded-xl border p-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                  <svg viewBox="0 0 360 80" className="h-full w-full" aria-hidden="true">
                    <path d={buildLinePath(summary.analytics.taskProgressTrend.map((x) => x.avgProgress), 360, 80)} fill="none" stroke="var(--accent-strong)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </Surface>

        <AttendanceCard initialCheckedIn={currentUserCheckedIn} />

        <Surface className="p-2">
          <div className="grid grid-cols-2 gap-2">
            {(["analytics", "workspace"] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveDashboardTab(tab)} className="rounded-xl px-4 py-2.5 text-sm font-semibold transition" style={{ background: activeDashboardTab === tab ? "var(--accent)" : "var(--surface-soft)", color: activeDashboardTab === tab ? "white" : "var(--text-main)" }}>
                {tab === "analytics" ? "Analytics" : "Google Workspace"}
              </button>
            ))}
          </div>
        </Surface>

        {activeDashboardTab === "analytics" ? (
          <>
            <section className="space-y-4" id="overview-section">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Analytics snapshot</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">Core metrics</h2>
              </div>
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {overviewStats.map((stat) => <SummaryStatCard key={stat.label} label={stat.label} value={stat.value} helper={stat.helper} points={stat.points} />)}
              </section>
              <InsightTicker items={insightItems} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <LineChartCard title="Personal work-hour trend" subtitle="Daily work-hour movement for workload tracking." values={summary.analytics.workingHoursTrend.map((x) => x.hours)} labels={summary.analytics.workingHoursTrend.map((x) => x.label)} suffix="h" stroke="var(--accent)" fill="color-mix(in srgb, var(--accent) 14%, transparent)" />
                <LineChartCard title="Task progress trend" subtitle="Completion momentum across recent days." values={summary.analytics.taskProgressTrend.map((x) => x.avgProgress)} labels={summary.analytics.taskProgressTrend.map((x) => x.label)} suffix="%" stroke="var(--success)" fill="color-mix(in srgb, var(--success) 12%, transparent)" />
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ActivityBarsCard title="Created vs completed activity" subtitle="Daily workload creation compared with daily completion." labels={recentTrend.map((x) => x.label)} createdValues={recentTrend.map((x) => x.created)} completedValues={recentTrend.map((x) => x.completed)} />
                <PerformanceBars title="Operational quality indicators" subtitle="Modern CRM quality stack for delivery confidence." items={[{ label: "Task completion quality", value: completionRate, helper: "Share of tasks reaching done state" }, { label: "Live team availability", value: attendanceRate, helper: "Currently checked-in users" }, { label: "Momentum health", value: Math.max(0, Math.min(100, 50 + Math.round(progressDelta * 5))), helper: "Trend-adjusted execution pulse" }]} />
              </div>
            </section>
            <section className="space-y-4" id="analytics-section">
              {myAnalyticsLoading ? (
                <StatePanel title="Loading your attendance heatmap" description="Preparing your recent attendance pattern." />
              ) : myAttendanceHeatmap.length ? (
                <HeatmapGrid title="My attendance heatmap" subtitle="Your attendance pattern over the past few weeks." items={myAttendanceHeatmap} />
              ) : (
                <StatePanel title="No attendance yet" description="No attendance history found for your account in this period." />
              )}
            </section>
          </>
        ) : (
          <section className="space-y-5" id="workspace-section">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Connected tools</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">Google Workspace</h2>
            </div>
            {canUseGoogleWorkspace(summary.scope) ? (
              <GoogleWorkspacePanel scope={summary.scope} status={workspaceStatus} loading={workspaceLoading} message={workspaceMessage} projects={workspaceProjects} users={workspaceUsers} selectedProjectId={selectedWorkspaceProjectId} actionLoading={workspaceActionLoading} meetResult={meetResult} sheetResult={sheetResult} driveResult={driveResult} onClearMeetResult={() => setMeetResult(null)} onClearSheetResult={() => setSheetResult(null)} onClearDriveResult={() => setDriveResult(null)} onSelectProject={setSelectedWorkspaceProjectId} onConnect={() => void handleGoogleConnect()} onDisconnect={() => void handleGoogleDisconnect()} onCreateMeet={(ids) => void runWorkspaceAction("meet", ids)} onCreateSheet={() => void runWorkspaceAction("sheets")} onCreateDriveFolder={() => void runWorkspaceAction("drive")} onSetMessage={setWorkspaceMessage} />
            ) : (
              <StatePanel title="Google Workspace unavailable" description="Only admin and superadmin accounts can use this tab." />
            )}
          </section>
        )}
      </div>
    </CRMShell>
  );
}
