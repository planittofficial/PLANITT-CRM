"use client";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Surface, formatRole, rosterRolePillStyle, LineChartCard, HeatmapGrid } from "./chart-widgets";
import { StatusBreakdownCard, TaskSummaryList } from "./data-panels";
import { StatePanel } from "@/components/shared/state-panel";
import type { CRMUser, DashboardSummary, UserAnalyticsSummary } from "@/types/crm";

function TeamMemberCard({ member, active, onClick }: { member: CRMUser; active: boolean; onClick: () => void }) {
  const dept = member.department?.name || "Unassigned";
  const mgr = member.manager?.name || "—";
  const designation = member.designation?.trim() || "Team member";
  return (
    <button type="button" onClick={onClick} className="group w-full rounded-2xl border px-3 py-2.5 text-left transition hover:opacity-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
      style={{ borderWidth: active ? 2 : 1, borderStyle: "solid", borderColor: active ? "var(--accent-strong)" : "var(--border)", background: active ? "linear-gradient(180deg, color-mix(in srgb, var(--accent) 14%, var(--surface)) 0%, var(--surface) 100%)" : "var(--surface)", boxShadow: active ? "0 0 0 1px color-mix(in srgb, var(--accent-strong) 25%, transparent), 0 12px 28px rgba(37, 99, 235, 0.12)" : "0 1px 0 color-mix(in srgb, var(--border) 40%, transparent)" }}>
      <div className="flex items-center gap-3">
        <UserAvatar
          name={member.name}
          avatarUrl={member.avatarUrl}
          authProvider={member.authProvider}
          className="h-10 w-10 shrink-0 rounded-xl text-xs"
          imageClassName="rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-[var(--text-main)]">{member.name}</p>
              <p className="mt-0.5 truncate text-[11px] leading-snug text-[var(--text-soft)]">{designation}</p>
            </div>
            <span className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]" style={rosterRolePillStyle(member.role)}>{formatRole(member.role)}</span>
          </div>
          <p className="mt-1.5 truncate text-[11px] leading-relaxed text-[var(--text-faint)]" title={`${dept} · ${mgr}`}>
            <span className="font-medium text-[var(--text-soft)]">Dept</span> {dept}
            <span className="mx-1.5 text-[var(--border)]" aria-hidden>·</span>
            <span className="font-medium text-[var(--text-soft)]">Mgr</span> {mgr}
          </p>
        </div>
      </div>
    </button>
  );
}

export function TeamAnalyticsPanel({ members, selectedMemberId, selectedAnalytics, analyticsLoading, directoryTitle, directorySubtitle, onSelect }: {
  members: CRMUser[]; selectedMemberId: string; selectedAnalytics: UserAnalyticsSummary | null; analyticsLoading: boolean; directoryTitle: string; directorySubtitle: string; onSelect: (id: string) => void;
}) {
  return (
    <div className="grid min-h-0 items-stretch gap-4 lg:min-h-[min(62vh,780px)] lg:grid-cols-[minmax(280px,0.42fr)_1fr] xl:grid-cols-[minmax(300px,0.4fr)_1fr]">
      <Surface className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-0">
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--surface)) 0%, var(--surface) 55%)" }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">{directorySubtitle}</p>
              <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-main)] sm:text-xl">{directoryTitle}</h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--text-soft)]">Tap a row to open analytics. Scroll the list for everyone.</p>
            </div>
            <span className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums" style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}>{members.length} {members.length === 1 ? "member" : "members"}</span>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border p-2 sm:p-2.5" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface-soft) 65%, var(--surface))" }}>
            <div className="max-h-[min(42vh,420px)] min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5 lg:max-h-[min(58vh,620px)]" style={{ scrollbarGutter: "stable" }}>
              {members.map((member) => (
                <TeamMemberCard key={member.id} member={member} active={member.id === selectedMemberId} onClick={() => onSelect(member.id)} />
              ))}
            </div>
          </div>
        </div>
      </Surface>

      <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:h-full">
        {analyticsLoading || !selectedAnalytics ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <StatePanel title="Loading team analytics" description="Preparing attendance, progress, and work-hour charts for the selected member." />
          </div>
        ) : (
          <>
            <Surface className="overflow-hidden p-0">
              <div className="border-b px-6 py-6" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--surface)) 0%, var(--surface) 58%)" }}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Selected team member</p>
                    <h3 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{selectedAnalytics.user.name}</h3>
                    <p className="mt-2 text-sm text-[var(--text-soft)]">{selectedAnalytics.user.designation || "Team member"} · {formatRole(selectedAnalytics.user.role)} · {selectedAnalytics.user.department?.name || "No department"}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[["Status", selectedAnalytics.metrics.checkedIn ? "Checked in" : "Offline"], ["Avg hours", `${selectedAnalytics.metrics.avgDailyHours}h`], ["Avg progress", `${selectedAnalytics.metrics.avgProgress}%`]].map(([label, val]) => (
                      <div key={label} className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">{label}</p>
                        <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 px-6 py-6 md:grid-cols-2 xl:grid-cols-4">
                {[["Assigned tasks", selectedAnalytics.metrics.totalTasks], ["Completed", selectedAnalytics.metrics.completedTasks], ["Pending", selectedAnalytics.metrics.pendingTasks], ["Attendance days", selectedAnalytics.metrics.attendanceDays]].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border px-4 py-4" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">{label}</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{value}</p>
                  </div>
                ))}
              </div>
            </Surface>
            <div className="grid gap-4 xl:grid-cols-2">
              <LineChartCard title="Daily work hours" subtitle="Recent working-hour movement for the selected team member." values={selectedAnalytics.analytics.workingHoursTrend.map((x) => x.hours)} labels={selectedAnalytics.analytics.workingHoursTrend.map((x) => x.label)} suffix="h" stroke="var(--accent)" fill="color-mix(in srgb, var(--accent) 16%, transparent)" />
              <LineChartCard title="Work progress trend" subtitle="Average task progress updates over the last two weeks." values={selectedAnalytics.analytics.taskProgressTrend.map((x) => x.avgProgress)} labels={selectedAnalytics.analytics.taskProgressTrend.map((x) => x.label)} suffix="%" stroke="var(--success)" fill="color-mix(in srgb, var(--success) 14%, transparent)" />
            </div>
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <HeatmapGrid title="Attendance intensity" subtitle="Attendance pattern over the past 35 days." items={selectedAnalytics.analytics.attendanceHeatmap} />
              <StatusBreakdownCard title="Task status split" items={selectedAnalytics.taskStatusBreakdown} />
            </div>
            <Surface className="p-5">
              <div className="mb-4"><p className="text-sm font-semibold text-[var(--text-main)]">Recent assigned work</p><p className="mt-1 text-sm text-[var(--text-soft)]">Latest tasks to help leadership review delivery context quickly.</p></div>
              {selectedAnalytics.recentTasks.length ? <TaskSummaryList tasks={selectedAnalytics.recentTasks} /> : <StatePanel title="No tasks found" description="This team member does not have assigned tasks yet." />}
            </Surface>
          </>
        )}
      </div>
    </div>
  );
}

export function DepartmentWisePanel({ departments }: {
  departments: NonNullable<Extract<DashboardSummary, { scope: "superadmin" | "admin" }>["analytics"]["superAdmin"]>["departmentWise"];
}) {
  return (
    <Surface className="p-5">
      <div className="mb-4"><p className="text-sm font-semibold text-[var(--text-main)]">Department-wise analytics</p><p className="mt-1 text-sm text-[var(--text-soft)]">Detailed CRM performance by department for CEO-level review.</p></div>
      <div className="mb-4 overflow-x-auto">
        <table className="min-w-[720px] w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
              <th className="px-3 py-2">Department</th><th className="px-3 py-2">Members</th><th className="px-3 py-2">Projects</th><th className="px-3 py-2">Tasks</th><th className="px-3 py-2">Completion</th><th className="px-3 py-2">Progress</th><th className="px-3 py-2">Attendance</th><th className="px-3 py-2">Open issues</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.departmentId} className="rounded-2xl border" style={{ background: "var(--surface-soft)", borderColor: "var(--border)" }}>
                <td className="rounded-l-2xl px-3 py-3 text-sm font-semibold text-[var(--text-main)]">{d.departmentName}</td>
                <td className="px-3 py-3 text-sm text-[var(--text-soft)]">{d.members} ({d.managers} managers, {d.interns} interns)</td>
                <td className="px-3 py-3 text-sm text-[var(--text-soft)]">{d.totalProjects}</td>
                <td className="px-3 py-3 text-sm text-[var(--text-soft)]">{d.completedTasks}/{d.totalTasks}</td>
                <td className="px-3 py-3 text-sm font-semibold text-[var(--text-main)]">{d.completionRate}%</td>
                <td className="px-3 py-3 text-sm text-[var(--text-soft)]">{d.avgProgress}%</td>
                <td className="px-3 py-3 text-sm text-[var(--text-soft)]">{d.activeAttendance} live / {d.avgWorkingHours}h avg</td>
                <td className="rounded-r-2xl px-3 py-3 text-sm text-[var(--text-soft)]">{d.openIssues}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}
