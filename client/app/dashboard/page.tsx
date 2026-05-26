"use client";

import { CRMShell } from "@/components/layout/crm-shell";
import { AttendanceCard } from "@/components/modules/attendance-card";
import { MemberPickerToolbar } from "@/components/shared/member-picker-toolbar";
import { StatePanel } from "@/components/shared/state-panel";
import { renderSessionGate } from "@/components/shared/session-gate";
import { Surface, buildLinePath, SummaryStatCard, LineChartCard, ActivityBarsCard, InsightTicker, PerformanceBars, HeatmapGrid, formatRole } from "@/components/dashboard/chart-widgets";
import { TeamAnalyticsPanel, DepartmentWisePanel } from "@/components/dashboard/team-analytics-panel";
import { GoogleWorkspacePanel } from "@/components/dashboard/google-workspace-panel";
import { canUseGoogleWorkspace, useDashboardData } from "@/hooks/use-dashboard-data";
import type { EmployeeDashboardSummary } from "@/types/crm";

export default function DashboardPage() {
  const {
    user, loading, error, sessionError, retrySession, summary, teamLoading, analyticsLoading,
    selectedMemberId, selectedAnalytics, teamDirectoryRoleFilter, teamDirectoryRoleOptions,
    filteredTeamMembers, overviewStats, leadershipView, globalSearch, setGlobalSearch, 
    setTeamDirectoryRoleFilter, setSelectedMemberId, workspaceStatus, workspaceProjects,
    workspaceUsers, selectedWorkspaceProjectId, workspaceActionLoading, meetResult, sheetResult,
    driveResult, workspaceLoading, workspaceMessage, activeDashboardTab, setActiveDashboardTab,
    setMeetResult, setSheetResult, setDriveResult, setSelectedWorkspaceProjectId, setWorkspaceMessage,
    handleGoogleConnect, handleGoogleDisconnect, runWorkspaceAction,
  } = useDashboardData();

  const sessionGate = renderSessionGate({ loading, user, error: sessionError, retry: retrySession, loadingTitle: "Loading workspace", loadingDescription: "Preparing your CRM dashboard." });
  if (sessionGate) return sessionGate;
  if (!user) return null;

  if (error || !summary) {
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

  return (
    <CRMShell user={user}>
      <div className="space-y-4">
        <Surface className="overflow-hidden p-0">
          <div className="grid gap-4 px-4 py-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
                {summary.scope === "superadmin" ? "CEO command center" : summary.scope === "admin" ? "Admin command center" : "Personal command center"}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]">Welcome back, {user.name.split(" ")[0]}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">{leadershipView ? "Track key team health and progress in one place." : "See your daily attendance, work hours, and progress quickly."}</p>
              <div className="mt-4 grid max-w-2xl gap-2 sm:grid-cols-2">
                <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Focus</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{leadershipView ? "Operations" : "My work"}</p>
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
              <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {overviewStats.map((stat) => <SummaryStatCard key={stat.label} label={stat.label} value={stat.value} helper={stat.helper} points={stat.points} />)}
              </section>
              <InsightTicker items={insightItems} />
              {leadershipView ? (
                <section className="space-y-4" id="team-directory">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Team directory</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">Member performance</h2>
                    <p className="mt-2 max-w-2xl text-sm text-[var(--text-soft)]">Use the header search or the filters below to find people. Select a card to load attendance, progress, and tasks.</p>
                  </div>
                  <MemberPickerToolbar searchQuery={globalSearch } onSearchChange={setGlobalSearch} roleFilter={teamDirectoryRoleFilter} onRoleFilterChange={setTeamDirectoryRoleFilter} roleOptions={teamDirectoryRoleOptions} />
                  {teamLoading ? <StatePanel title="Loading team directory" description="Fetching people and baseline analytics." />
                    : filteredTeamMembers.length === 0 ? <StatePanel title="No matching team members" description="Try a different search or clear the role filter." />
                    : <TeamAnalyticsPanel members={filteredTeamMembers} selectedMemberId={selectedMemberId} selectedAnalytics={selectedAnalytics} analyticsLoading={analyticsLoading} directoryTitle="Roster" directorySubtitle="Live roster and analytics" onSelect={setSelectedMemberId} />}
                </section>
              ) : null}
              {leadershipView && summary.scope === "superadmin" && summary.analytics.superAdmin?.departmentWise ? (
                <DepartmentWisePanel departments={summary.analytics.superAdmin.departmentWise} />
              ) : null}
              <div className="grid gap-4 xl:grid-cols-2">
                <LineChartCard title={leadershipView ? "Organization work-hour trend" : "Personal work-hour trend"} subtitle="Daily work-hour movement for workload tracking." values={summary.analytics.workingHoursTrend.map((x) => x.hours)} labels={summary.analytics.workingHoursTrend.map((x) => x.label)} suffix="h" stroke="var(--accent)" fill="color-mix(in srgb, var(--accent) 14%, transparent)" />
                <LineChartCard title="Task progress trend" subtitle="Completion momentum across recent days." values={summary.analytics.taskProgressTrend.map((x) => x.avgProgress)} labels={summary.analytics.taskProgressTrend.map((x) => x.label)} suffix="%" stroke="var(--success)" fill="color-mix(in srgb, var(--success) 12%, transparent)" />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <ActivityBarsCard title="Created vs completed activity" subtitle="Daily workload creation compared with daily completion." labels={recentTrend.map((x) => x.label)} createdValues={recentTrend.map((x) => x.created)} completedValues={recentTrend.map((x) => x.completed)} />
                <PerformanceBars title="Operational quality indicators" subtitle="Modern CRM quality stack for delivery confidence." items={[{ label: "Task completion quality", value: completionRate, helper: "Share of tasks reaching done state" }, { label: "Live team availability", value: attendanceRate, helper: "Currently checked-in users" }, { label: "Momentum health", value: Math.max(0, Math.min(100, 50 + Math.round(progressDelta * 5))), helper: "Trend-adjusted execution pulse" }]} />
              </div>
            </section>
            <section className="space-y-4" id="analytics-section">
              <HeatmapGrid title={summary.scope === "employee" ? "Attendance heatmap" : "Team attendance heatmap"} subtitle="Recent attendance pattern." items={summary.analytics.attendanceHeatmap} />
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
