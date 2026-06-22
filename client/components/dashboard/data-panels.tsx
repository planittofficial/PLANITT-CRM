"use client";

import { Surface } from "./chart-widgets";
import type { UserAnalyticsSummary } from "@/types/crm";

export function UpdateFeed({ title, items }: {
  title: string;
  items: Array<{ id: string; title: string; message: string; authorName: string; authorRole: string; taskTitle?: string | null; createdAt: string }>;
}) {
  return (
    <Surface className="p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
      <div className="mt-4 space-y-3">
        {items.length ? items.map((item) => (
          <article key={item.id} className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--text-main)]">{item.title}</p>
              <span className="text-xs text-[var(--text-faint)]">{new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-[var(--text-soft)]">{item.message}</p>
            <p className="mt-2 text-xs text-[var(--text-faint)]">{item.authorName} ({item.authorRole}) {item.taskTitle ? `- ${item.taskTitle}` : ""}</p>
          </article>
        )) : <p className="text-sm text-[var(--text-soft)]">No recent leadership updates.</p>}
      </div>
    </Surface>
  );
}

export function TaskSummaryList({ tasks }: { tasks: UserAnalyticsSummary["recentTasks"] }) {
  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <article key={task.id} className="rounded-2xl border px-4 py-4" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-main)]">{task.title}</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">{task.description || "No description added yet."}</p>
            </div>
            <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ background: task.status === "DONE" ? "color-mix(in srgb, var(--success) 16%, var(--surface))" : task.status === "IN_PROGRESS" ? "color-mix(in srgb, var(--accent) 16%, var(--surface))" : "var(--surface)", color: task.status === "DONE" ? "var(--success)" : "var(--text-soft)" }}>
              {task.status.replace("_", " ")}
            </span>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-faint)]">Progress</p>
              <p className="text-sm font-semibold text-[var(--text-main)]">{task.progress}%</p>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface)" }}>
              <div className="h-full rounded-full" style={{ width: `${task.progress}%`, background: "linear-gradient(90deg, var(--accent-strong) 0%, var(--accent) 60%, var(--success) 100%)" }} />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function StatusBreakdownCard({ title, items }: { title: string; items: Array<{ label: string; value: number }> }) {
  const total = Math.max(items.reduce((s, x) => s + x.value, 0), 1);
  return (
    <Surface className="p-3 sm:p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
      <div className="mt-5 space-y-4">
        {items.map((item, index) => {
          const pct = Math.round((item.value / total) * 100);
          const colors = ["var(--text-faint)", "var(--accent)", "var(--success)"];
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--text-main)]">{item.label}</p>
                <span className="text-sm font-semibold text-[var(--text-main)]">{item.value} <span className="text-[var(--text-faint)]">({pct}%)</span></span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full" style={{ background: "var(--surface-soft)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[index] ?? "var(--accent)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}

export function DonutChartCard({ title, subtitle, items }: { title: string; subtitle: string; items: Array<{ label: string; value: number; color: string }> }) {
  const total = Math.max(items.reduce((s, x) => s + Math.max(0, x.value), 0), 1);
  const r = 58; const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Surface className="p-3 sm:p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p>
      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="relative h-32 w-32 shrink-0 sm:h-40 sm:w-40">
          <svg viewBox="0 0 160 160" className="h-32 w-32 -rotate-90 sm:h-40 sm:w-40" aria-hidden="true">
            <circle cx="80" cy="80" r={r} fill="none" stroke="var(--surface-soft)" strokeWidth="20" />
            {items.map((item) => {
              const v = Math.max(0, item.value);
              const len = (v / total) * circ;
              const cur = offset; offset += len;
              return <circle key={item.label} cx="80" cy="80" r={r} fill="none" stroke={item.color} strokeWidth="20" strokeLinecap="round" strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-cur} />;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Total</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-main)]">{total}</p>
          </div>
        </div>
        <div className="w-full min-w-0 flex-1 space-y-2.5">
          {items.map((item) => {
            const pct = Math.round((Math.max(0, item.value) / total) * 100);
            return (
              <div key={`${item.label}-legend`} className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} /><p className="text-sm text-[var(--text-main)]">{item.label}</p></div>
                  <p className="text-sm font-semibold text-[var(--text-main)]">{item.value} <span className="text-[var(--text-faint)]">({pct}%)</span></p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}

export function MilestoneCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <Surface className="p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-main)] sm:mt-3 sm:text-3xl">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{helper}</p>
    </Surface>
  );
}

export function TeamProductivityScoreCard({ score, completionRate, attendanceRate, momentum }: { score: number; completionRate: number; attendanceRate: number; momentum: number }) {
  return (
    <Surface className="p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">Team productivity score</p>
      <p className="mt-1 text-sm text-[var(--text-soft)]">Weighted by completion, attendance, and momentum.</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-4xl font-semibold text-[var(--text-main)]">{score}</p>
        <p className="text-sm text-[var(--text-soft)]">/ 100</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[["Completion", `${completionRate}%`], ["Attendance", `${attendanceRate}%`], ["Momentum", `${momentum >= 0 ? "+" : ""}${momentum}%`]].map(([label, val]) => (
          <div key={label} className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)]">{label}</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{val}</p>
          </div>
        ))}
      </div>
    </Surface>
  );
}

export function WeeklyForecastCard({ forecastPercent, forecastCompleted, baseCompleted }: { forecastPercent: number; forecastCompleted: number; baseCompleted: number }) {
  return (
    <Surface className="p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">Weekly forecast</p>
      <p className="mt-1 text-sm text-[var(--text-soft)]">Predicted completion for next week using moving average.</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold text-[var(--text-main)]">{forecastPercent}%</p>
        <p className="text-xs text-[var(--text-faint)]">Projected rate</p>
      </div>
      <p className="mt-3 text-sm text-[var(--text-soft)]">Forecast completed tasks: {forecastCompleted} (current: {baseCompleted})</p>
    </Surface>
  );
}

export function RiskAlertsCard({ alerts }: { alerts: Array<{ id: string; label: string; detail: string; severity: "high" | "medium" }> }) {
  return (
    <Surface className="p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">Risk alerts</p>
      <p className="mt-1 text-sm text-[var(--text-soft)]">Priority signals that need follow-up.</p>
      <div className="mt-4 space-y-2.5">
        {alerts.length ? alerts.map((alert) => (
          <div key={alert.id} className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--text-main)]">{alert.label}</p>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ background: alert.severity === "high" ? "color-mix(in srgb, #ef4444 20%, var(--surface))" : "color-mix(in srgb, #f59e0b 20%, var(--surface))", color: alert.severity === "high" ? "#b91c1c" : "#b45309" }}>{alert.severity}</span>
            </div>
            <p className="mt-1 text-sm text-[var(--text-soft)]">{alert.detail}</p>
          </div>
        )) : <p className="text-sm text-[var(--text-soft)]">No active risks. Everything looks stable right now.</p>}
      </div>
    </Surface>
  );
}

export function PerformerListCard({ title, subtitle, items }: { title: string; subtitle: string; items: Array<{ id: string; name: string; role: string; score: number }> }) {
  return (
    <Surface className="p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p>
      <div className="mt-4 space-y-2.5">
        {items.length ? items.map((item) => (
          <div key={item.id} className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{item.name}</p><p className="text-xs text-[var(--text-soft)]">{item.role}</p></div>
              <p className="text-sm font-semibold text-[var(--text-main)]">{item.score}</p>
            </div>
          </div>
        )) : <p className="text-sm text-[var(--text-soft)]">Not enough data yet.</p>}
      </div>
    </Surface>
  );
}
