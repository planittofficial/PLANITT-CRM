"use client";

import { useEffect, useState } from "react";
import { Surface } from "./chart-widgets";
import type { UserAnalyticsSummary } from "@/types/crm";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

export function UpdateFeed({
  title,
  items,
}: {
  title: string;
  items: Array<{
    id: string;
    title: string;
    message: string;
    authorName: string;
    authorRole: string;
    taskTitle?: string | null;
    createdAt: string;
  }>;
}) {
  return (
    <Surface className="p-4 sm:p-5">
      <h4 className="text-sm font-semibold text-[var(--text-main)]">{title}</h4>
      <div className="mt-3.5 space-y-2.5">
        {items.length ? (
          items.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 transition-colors hover:bg-[var(--surface-hover)]"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--text-main)] truncate">
                  {item.title}
                </p>
                <span className="shrink-0 text-[11px] text-[var(--text-faint)]">
                  {new Date(item.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--text-soft)]">{item.message}</p>
              <p className="mt-1.5 text-[11px] text-[var(--text-faint)] truncate">
                {item.authorName} ({item.authorRole.toLowerCase()})
                {item.taskTitle ? ` · ${item.taskTitle}` : ""}
              </p>
            </article>
          ))
        ) : (
          <p className="py-4 text-center text-xs text-[var(--text-soft)]">
            No recent leadership updates.
          </p>
        )}
      </div>
    </Surface>
  );
}

export function TaskSummaryList({ tasks }: { tasks: UserAnalyticsSummary["recentTasks"] }) {
  return (
    <div className="space-y-2.5">
      {tasks.map((task) => (
        <article
          key={task.id}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3.5 transition-colors hover:bg-[var(--surface-hover)]"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h5 className="text-sm font-semibold text-[var(--text-main)] truncate">
                {task.title}
              </h5>
              <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-soft)]">
                {task.description || "No description provided."}
              </p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                task.status === "DONE"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                  : task.status === "IN_PROGRESS"
                  ? "bg-indigo-50 text-[var(--accent)] border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                  : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
              }`}
            >
              {task.status.replace("_", " ")}
            </span>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-[var(--text-soft)] mb-1">
              <span>Progress</span>
              <span className="font-semibold text-[var(--text-main)]">{task.progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)] border border-[var(--border)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function StatusBreakdownCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
}) {
  const total = Math.max(
    items.reduce((s, x) => s + x.value, 0),
    1
  );

  return (
    <Surface className="p-4 sm:p-5">
      <h4 className="text-sm font-semibold text-[var(--text-main)]">{title}</h4>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => {
          const pct = Math.round((item.value / total) * 100);
          const colors = ["var(--text-faint)", "var(--accent)", "#107c41"];

          return (
            <div key={item.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--text-main)]">{item.label}</span>
                <span className="font-semibold text-[var(--text-main)]">
                  {item.value} <span className="text-[var(--text-soft)]">({pct}%)</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)] border border-[var(--border)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: colors[index % colors.length] ?? "var(--accent)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}

export function DonutChartCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; value: number; color: string }>;
}) {
  const [mounted, setMounted] = useState(false);
  const total = Math.max(
    items.reduce((s, x) => s + Math.max(0, x.value), 0),
    1
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = items.map((item) => ({
    name: item.label,
    value: Math.max(0, item.value),
    color: item.color,
  }));

  return (
    <Surface className="p-4 sm:p-5">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-[var(--text-main)]">{title}</h4>
        <p className="mt-0.5 text-xs text-[var(--text-soft)]">{subtitle}</p>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="relative h-36 w-36 shrink-0 sm:h-40 sm:w-40">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0];
                    return (
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-md text-xs">
                        <span className="font-semibold text-[var(--text-main)]">{p.name}: </span>
                        <span>{p.value}</span>
                      </div>
                    );
                  }}
                />
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={68}
                  paddingAngle={3}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="var(--surface)" strokeWidth={2} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full rounded-full border-4 border-dashed border-[var(--border)]" />
          )}

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
              Total
            </span>
            <span className="text-xl font-bold text-[var(--text-main)]">{total}</span>
          </div>
        </div>

        <div className="w-full min-w-0 flex-1 space-y-2">
          {items.map((item) => {
            const pct = Math.round((Math.max(0, item.value) / total) * 100);
            return (
              <div
                key={`${item.label}-legend`}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: item.color }}
                  />
                  <span className="truncate text-[var(--text-main)] font-medium">{item.label}</span>
                </div>
                <span className="font-semibold text-[var(--text-main)] shrink-0">
                  {item.value} <span className="text-[var(--text-soft)]">({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}

export function MilestoneCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <Surface className="p-4 sm:p-5">
      <p className="text-xs font-medium text-[var(--text-soft)]">{title}</p>
      <h3 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text-main)] sm:text-3xl">
        {value}
      </h3>
      <p className="mt-1 text-xs text-[var(--text-soft)]">{helper}</p>
    </Surface>
  );
}

export function TeamProductivityScoreCard({
  score,
  completionRate,
  attendanceRate,
  momentum,
}: {
  score: number;
  completionRate: number;
  attendanceRate: number;
  momentum: number;
}) {
  return (
    <Surface className="p-4 sm:p-5">
      <h4 className="text-sm font-semibold text-[var(--text-main)]">Team productivity score</h4>
      <p className="mt-0.5 text-xs text-[var(--text-soft)]">
        Weighted by completion, attendance, and momentum.
      </p>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-3xl font-bold text-[var(--text-main)]">{score}</span>
        <span className="text-xs text-[var(--text-soft)]">/ 100</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["Completion", `${completionRate}%`],
          ["Attendance", `${attendanceRate}%`],
          ["Momentum", `${momentum >= 0 ? "+" : ""}${momentum}%`],
        ].map(([label, val]) => (
          <div
            key={label}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2 text-center"
          >
            <p className="text-[10px] text-[var(--text-faint)]">{label}</p>
            <p className="mt-0.5 text-xs font-bold text-[var(--text-main)]">{val}</p>
          </div>
        ))}
      </div>
    </Surface>
  );
}

export function WeeklyForecastCard({
  forecastPercent,
  forecastCompleted,
  baseCompleted,
}: {
  forecastPercent: number;
  forecastCompleted: number;
  baseCompleted: number;
}) {
  return (
    <Surface className="p-4 sm:p-5">
      <h4 className="text-sm font-semibold text-[var(--text-main)]">Weekly forecast</h4>
      <p className="mt-0.5 text-xs text-[var(--text-soft)]">
        Predicted completion for next week using moving average.
      </p>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-3xl font-bold text-[var(--text-main)]">{forecastPercent}%</span>
        <span className="text-xs text-[var(--text-soft)]">Projected rate</span>
      </div>
      <p className="mt-2 text-xs text-[var(--text-soft)]">
        Forecast completed tasks:{" "}
        <strong className="text-[var(--text-main)]">{forecastCompleted}</strong> (current:{" "}
        {baseCompleted})
      </p>
    </Surface>
  );
}

export function RiskAlertsCard({
  alerts,
}: {
  alerts: Array<{ id: string; label: string; detail: string; severity: "high" | "medium" }>;
}) {
  return (
    <Surface className="p-4 sm:p-5">
      <h4 className="text-sm font-semibold text-[var(--text-main)]">Risk alerts</h4>
      <p className="mt-0.5 text-xs text-[var(--text-soft)]">Priority signals that need attention.</p>
      <div className="mt-3 space-y-2">
        {alerts.length ? (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--text-main)] truncate">
                  {alert.label}
                </p>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold border ${
                    alert.severity === "high"
                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                  }`}
                >
                  {alert.severity}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-soft)]">{alert.detail}</p>
            </div>
          ))
        ) : (
          <p className="py-2 text-xs text-[var(--text-soft)]">
            No active risks. Everything looks healthy.
          </p>
        )}
      </div>
    </Surface>
  );
}

export function PerformerListCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ id: string; name: string; role: string; score: number }>;
}) {
  return (
    <Surface className="p-4 sm:p-5">
      <h4 className="text-sm font-semibold text-[var(--text-main)]">{title}</h4>
      <p className="mt-0.5 text-xs text-[var(--text-soft)]">{subtitle}</p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--text-main)]">{item.name}</p>
                <p className="text-[11px] text-[var(--text-soft)]">{item.role}</p>
              </div>
              <span className="font-bold text-[var(--text-main)]">{item.score}</span>
            </div>
          ))
        ) : (
          <p className="py-2 text-xs text-[var(--text-soft)]">Not enough activity data yet.</p>
        )}
      </div>
    </Surface>
  );
}
