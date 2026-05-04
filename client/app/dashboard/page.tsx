"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { useCrmSearch } from "@/components/providers/crm-search-provider";
import {
  MemberPickerToolbar,
  filterMembersForPicker,
  sortedUniqueRoles,
  type MemberRoleFilter,
} from "@/components/shared/member-picker-toolbar";
import { AttendanceCard } from "@/components/modules/attendance-card";
import { StatePanel } from "@/components/shared/state-panel";
import { renderSessionGate } from "@/components/shared/session-gate";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useSession } from "@/hooks/use-session";
import { apiDelete, apiGet, apiPost, apiPostForm } from "@/lib/api";
import { normalizeErrorMessage } from "@/lib/error-message";
import type {
  CRMUser,
  DashboardSummary,
  EmployeeDashboardSummary,
  GoogleDriveFolderResult,
  GoogleDriveUploadResult,
  GoogleMeetSessionResult,
  GoogleProjectSheetResult,
  GoogleWorkspaceStatus,
  Project,
  UserAnalyticsSummary,
} from "@/types/crm";

type WorkspaceActionLoading = "" | "meet" | "sheets" | "drive";
const TEAM_ANALYTICS_PRELOAD_LIMIT = 8;

function Surface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[24px] border ${className}`}
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      {children}
    </section>
  );
}

function formatRole(role: CRMUser["role"]) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function rosterRolePillStyle(role: CRMUser["role"]): CSSProperties {
  switch (role) {
    case "SUPERADMIN":
    case "ADMIN":
      return {
        background: "color-mix(in srgb, var(--accent) 20%, var(--surface))",
        color: "var(--accent-strong)",
        borderColor: "color-mix(in srgb, var(--accent) 40%, var(--border))",
      };
    case "MANAGER":
      return {
        background: "color-mix(in srgb, var(--success) 18%, var(--surface))",
        color: "color-mix(in srgb, var(--success) 85%, var(--text-main))",
        borderColor: "color-mix(in srgb, var(--success) 35%, var(--border))",
      };
    case "EMPLOYEE":
      return {
        background: "color-mix(in srgb, var(--accent) 8%, var(--surface-soft))",
        color: "var(--text-main)",
        borderColor: "var(--border)",
      };
    case "INTERN":
    default:
      return {
        background: "var(--surface-soft)",
        color: "var(--text-soft)",
        borderColor: "var(--border)",
      };
  }
}

function canUseGoogleWorkspace(scope: DashboardSummary["scope"]) {
  return scope === "superadmin" || scope === "admin";
}

function workspaceAssetsStorageKey(userId: string) {
  return `crm-workspace-assets:${userId}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function buildLinePath(points: number[], width: number, height: number) {
  if (!points.length) {
    return "";
  }

  const max = Math.max(...points, 1);
  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - (point / max) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function SummaryStatCard({
  label,
  value,
  helper,
  points,
}: {
  label: string;
  value: string | number;
  helper: string;
  points: number[];
}) {
  const path = buildLinePath(points, 140, 44);

  return (
    <Surface className="overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
            {label}
          </p>
          <h3 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-main)]">{value}</h3>
          <p className="mt-2 text-sm text-[var(--text-soft)]">{helper}</p>
        </div>

        <div
          className="rounded-2xl border px-3 py-2"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
        >
          <svg width="140" height="44" viewBox="0 0 140 44" fill="none" aria-hidden="true">
            <path
              d={path}
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </Surface>
  );
}

function LineChartCard({
  title,
  subtitle,
  values,
  labels,
  suffix = "",
  stroke = "var(--accent)",
  fill = "color-mix(in srgb, var(--accent) 14%, transparent)",
}: {
  title: string;
  subtitle: string;
  values: number[];
  labels: string[];
  suffix?: string;
  stroke?: string;
  fill?: string;
}) {
  const width = 480;
  const height = 180;
  const max = Math.max(...values, 1);
  const path = buildLinePath(values, width, height - 24);
  const areaPath = values.length
    ? `${path} L ${width} ${height} L 0 ${height} Z`
    : "";

  return (
    <Surface className="p-5">
      <div className="mb-5">
        <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p>
      </div>

      <div className="overflow-hidden rounded-[20px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" aria-hidden="true">
          {[0, 1, 2, 3].map((step) => {
            const y = 12 + (step / 3) * (height - 36);
            return (
              <line
                key={step}
                x1="0"
                y1={y}
                x2={width}
                y2={y}
                stroke="color-mix(in srgb, var(--border) 80%, transparent)"
                strokeDasharray="4 6"
              />
            );
          })}
          {areaPath ? <path d={areaPath} fill={fill} /> : null}
          {path ? (
            <path
              d={path}
              fill="none"
              stroke={stroke}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {values.map((value, index) => {
            const x = (index / Math.max(values.length - 1, 1)) * width;
            const y = height - 24 - (value / max) * (height - 24);
            return <circle key={`${labels[index]}-${value}`} cx={x} cy={y} r="4" fill={stroke} />;
          })}
        </svg>

        <div className="mt-4 grid grid-cols-7 gap-2">
          {labels.map((label, index) => (
            <div key={`${label}-${index}`} className="text-center">
              <p className="text-[10px] text-[var(--text-faint)]">{label.split(" ")[1] ?? label}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--text-main)]">
                {values[index]}
                {suffix}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Surface>
  );
}

function ActivityBarsCard({
  title,
  subtitle,
  labels,
  createdValues,
  completedValues,
}: {
  title: string;
  subtitle: string;
  labels: string[];
  createdValues: number[];
  completedValues: number[];
}) {
  const maxValue = Math.max(1, ...createdValues, ...completedValues);

  return (
    <Surface className="p-5">
      <div className="mb-5">
        <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p>
      </div>

      <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
        <div className="space-y-3.5">
          {labels.map((label, index) => {
            const created = createdValues[index] ?? 0;
            const completed = completedValues[index] ?? 0;
            const createdWidth = (created / maxValue) * 100;
            const completedWidth = (completed / maxValue) * 100;

            return (
              <div key={`${label}-${index}`}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-[var(--text-main)]">{label}</p>
                  <p className="text-xs text-[var(--text-soft)]">
                    C:{created} / D:{completed}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--border) 60%, transparent)" }}>
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${createdWidth}%` }} />
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--border) 60%, transparent)" }}>
                  <div className="h-full rounded-full bg-[var(--success)]" style={{ width: `${completedWidth}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-[var(--text-soft)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
            Created
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
            Completed
          </span>
        </div>
      </div>
    </Surface>
  );
}

function InsightTicker({
  items,
}: {
  items: Array<{ label: string; value: string; tone: "neutral" | "positive" | "warning" }>;
}) {
  return (
    <Surface className="p-4">
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border px-4 py-3"
            style={{
              borderColor: "var(--border)",
              background:
                item.tone === "positive"
                  ? "color-mix(in srgb, var(--success) 12%, var(--surface))"
                  : item.tone === "warning"
                    ? "color-mix(in srgb, var(--warning) 12%, var(--surface))"
                    : "var(--surface-soft)",
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">{item.label}</p>
            <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">{item.value}</p>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function PerformanceBars({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; value: number; helper: string }>;
}) {
  return (
    <Surface className="p-5">
      <div className="mb-5">
        <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-main)]">{item.label}</p>
                <p className="text-xs text-[var(--text-soft)]">{item.helper}</p>
              </div>
              <span className="text-sm font-semibold text-[var(--text-main)]">{item.value}%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface-soft)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${item.value}%`,
                  background:
                    "linear-gradient(90deg, var(--accent-strong) 0%, var(--accent) 55%, var(--success) 100%)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function HeatmapGrid({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ date: string; label: string; value: number; intensity: number }>;
}) {
  return (
    <Surface className="p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p>
      <div className="mt-5 grid grid-cols-7 gap-2">
        {items.map((item) => (
          <div key={item.date} className="space-y-1 text-center">
            <div
              className="h-9 rounded-xl border"
              title={`${item.label}: ${item.value}`}
              style={{
                borderColor: "var(--border)",
                background: `linear-gradient(180deg, color-mix(in srgb, var(--accent) ${Math.max(
                  10,
                  item.intensity
                )}%, var(--surface-soft)), var(--surface-soft))`,
              }}
            />
            <p className="text-[10px] text-[var(--text-faint)]">{item.label.split(" ")[1] ?? item.label}</p>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function UpdateFeed({
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
    <Surface className="p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border px-4 py-3"
              style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--text-main)]">{item.title}</p>
                <span className="text-xs text-[var(--text-faint)]">
                  {new Date(item.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-[var(--text-soft)]">{item.message}</p>
              <p className="mt-2 text-xs text-[var(--text-faint)]">
                {item.authorName} ({item.authorRole}) {item.taskTitle ? `- ${item.taskTitle}` : ""}
              </p>
            </article>
          ))
        ) : (
          <p className="text-sm text-[var(--text-soft)]">No recent leadership updates.</p>
        )}
      </div>
    </Surface>
  );
}

function TaskSummaryList({
  tasks,
}: {
  tasks: UserAnalyticsSummary["recentTasks"];
}) {
  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <article
          key={task.id}
          className="rounded-2xl border px-4 py-4"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-main)]">{task.title}</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">{task.description || "No description added yet."}</p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{
                background:
                  task.status === "DONE"
                    ? "color-mix(in srgb, var(--success) 16%, var(--surface))"
                    : task.status === "IN_PROGRESS"
                      ? "color-mix(in srgb, var(--accent) 16%, var(--surface))"
                      : "var(--surface)",
                color: task.status === "DONE" ? "var(--success)" : "var(--text-soft)",
              }}
            >
              {task.status.replace("_", " ")}
            </span>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-faint)]">Progress</p>
              <p className="text-sm font-semibold text-[var(--text-main)]">{task.progress}%</p>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${task.progress}%`,
                  background:
                    "linear-gradient(90deg, var(--accent-strong) 0%, var(--accent) 60%, var(--success) 100%)",
                }}
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function StatusBreakdownCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
}) {
  const total = Math.max(items.reduce((sum, item) => sum + item.value, 0), 1);

  return (
    <Surface className="p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
      <div className="mt-5 space-y-4">
        {items.map((item, index) => {
          const percentage = Math.round((item.value / total) * 100);
          const colors = ["var(--text-faint)", "var(--accent)", "var(--success)"];
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--text-main)]">{item.label}</p>
                <span className="text-sm font-semibold text-[var(--text-main)]">
                  {item.value} <span className="text-[var(--text-faint)]">({percentage}%)</span>
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full" style={{ background: "var(--surface-soft)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percentage}%`,
                    background: colors[index] ?? "var(--accent)",
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

function DonutChartCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; value: number; color: string }>;
}) {
  const total = Math.max(
    items.reduce((sum, item) => sum + Math.max(0, item.value), 0),
    1
  );
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offsetCursor = 0;

  return (
    <Surface className="p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p>

      <div className="mt-5 flex items-center gap-5">
        <div className="relative h-40 w-40 shrink-0">
          <svg viewBox="0 0 160 160" className="h-40 w-40 -rotate-90" aria-hidden="true">
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="var(--surface-soft)"
              strokeWidth="20"
            />
            {items.map((item) => {
              const safeValue = Math.max(0, item.value);
              const length = (safeValue / total) * circumference;
              const strokeDasharray = `${length} ${circumference - length}`;
              const currentOffset = offsetCursor;
              offsetCursor += length;

              return (
                <circle
                  key={item.label}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="20"
                  strokeLinecap="round"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={-currentOffset}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Total</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-main)]">{total}</p>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          {items.map((item) => {
            const percent = Math.round((Math.max(0, item.value) / total) * 100);
            return (
              <div key={`${item.label}-legend`} className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                    <p className="text-sm text-[var(--text-main)]">{item.label}</p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-main)]">
                    {item.value} <span className="text-[var(--text-faint)]">({percent}%)</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}

function MilestoneCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <Surface className="p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-main)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--text-soft)]">{helper}</p>
    </Surface>
  );
}

function TeamProductivityScoreCard({
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
    <Surface className="p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">Team productivity score</p>
      <p className="mt-1 text-sm text-[var(--text-soft)]">Weighted by completion, attendance, and momentum.</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-4xl font-semibold text-[var(--text-main)]">{score}</p>
        <p className="text-sm text-[var(--text-soft)]">/ 100</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)]">Completion</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{completionRate}%</p>
        </div>
        <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)]">Attendance</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{attendanceRate}%</p>
        </div>
        <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
          <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)]">Momentum</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">
            {momentum >= 0 ? "+" : ""}
            {momentum}%
          </p>
        </div>
      </div>
    </Surface>
  );
}

function WeeklyForecastCard({
  forecastPercent,
  forecastCompleted,
  baseCompleted,
}: {
  forecastPercent: number;
  forecastCompleted: number;
  baseCompleted: number;
}) {
  return (
    <Surface className="p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">Weekly forecast</p>
      <p className="mt-1 text-sm text-[var(--text-soft)]">Predicted completion for next week using moving average.</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold text-[var(--text-main)]">{forecastPercent}%</p>
        <p className="text-xs text-[var(--text-faint)]">Projected rate</p>
      </div>
      <p className="mt-3 text-sm text-[var(--text-soft)]">
        Forecast completed tasks: {forecastCompleted} (current: {baseCompleted})
      </p>
    </Surface>
  );
}

function RiskAlertsCard({
  alerts,
}: {
  alerts: Array<{ id: string; label: string; detail: string; severity: "high" | "medium" }>;
}) {
  return (
    <Surface className="p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">Risk alerts</p>
      <p className="mt-1 text-sm text-[var(--text-soft)]">Priority signals that need follow-up.</p>
      <div className="mt-4 space-y-2.5">
        {alerts.length ? (
          alerts.map((alert) => (
            <div key={alert.id} className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--text-main)]">{alert.label}</p>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  style={{
                    background:
                      alert.severity === "high"
                        ? "color-mix(in srgb, #ef4444 20%, var(--surface))"
                        : "color-mix(in srgb, #f59e0b 20%, var(--surface))",
                    color: alert.severity === "high" ? "#b91c1c" : "#b45309",
                  }}
                >
                  {alert.severity}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--text-soft)]">{alert.detail}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--text-soft)]">No active risks. Everything looks stable right now.</p>
        )}
      </div>
    </Surface>
  );
}

function PerformerListCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ id: string; name: string; role: string; score: number }>;
}) {
  return (
    <Surface className="p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p>
      <div className="mt-4 space-y-2.5">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-main)]">{item.name}</p>
                  <p className="text-xs text-[var(--text-soft)]">{item.role}</p>
                </div>
                <p className="text-sm font-semibold text-[var(--text-main)]">{item.score}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--text-soft)]">Not enough data yet.</p>
        )}
      </div>
    </Surface>
  );
}

function TeamMemberCard({
  member,
  active,
  onClick,
}: {
  member: CRMUser;
  active: boolean;
  onClick: () => void;
}) {
  const dept = member.department?.name || "Unassigned";
  const mgr = member.manager?.name || "—";
  const designation = member.designation?.trim() || "Team member";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-2xl border px-3 py-2.5 text-left transition hover:opacity-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
      style={{
        borderWidth: active ? 2 : 1,
        borderStyle: "solid",
        borderColor: active ? "var(--accent-strong)" : "var(--border)",
        background: active
          ? "linear-gradient(180deg, color-mix(in srgb, var(--accent) 14%, var(--surface)) 0%, var(--surface) 100%)"
          : "var(--surface)",
        boxShadow: active
          ? "0 0 0 1px color-mix(in srgb, var(--accent-strong) 25%, transparent), 0 12px 28px rgba(37, 99, 235, 0.12)"
          : "0 1px 0 color-mix(in srgb, var(--border) 40%, transparent)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold tracking-tight"
          style={{
            background: active
              ? "color-mix(in srgb, var(--accent) 22%, var(--surface))"
              : "color-mix(in srgb, var(--accent) 12%, var(--surface-soft))",
            color: "var(--accent-strong)",
          }}
        >
          {getInitials(member.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-[var(--text-main)]">{member.name}</p>
              <p className="mt-0.5 truncate text-[11px] leading-snug text-[var(--text-soft)]">{designation}</p>
            </div>
            <span
              className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
              style={rosterRolePillStyle(member.role)}
            >
              {formatRole(member.role)}
            </span>
          </div>
          <p
            className="mt-1.5 truncate text-[11px] leading-relaxed text-[var(--text-faint)]"
            title={`${dept} · ${mgr}`}
          >
            <span className="font-medium text-[var(--text-soft)]">Dept</span> {dept}
            <span className="mx-1.5 text-[var(--border)]" aria-hidden>
              ·
            </span>
            <span className="font-medium text-[var(--text-soft)]">Mgr</span> {mgr}
          </p>
        </div>
      </div>
    </button>
  );
}

function TeamAnalyticsPanel({
  members,
  selectedMemberId,
  selectedAnalytics,
  analyticsLoading,
  directoryTitle,
  directorySubtitle,
  onSelect,
}: {
  members: CRMUser[];
  selectedMemberId: string;
  selectedAnalytics: UserAnalyticsSummary | null;
  analyticsLoading: boolean;
  directoryTitle: string;
  directorySubtitle: string;
  onSelect: (memberId: string) => void;
}) {
  return (
    <div className="grid min-h-[min(62vh,780px)] items-stretch gap-4 lg:grid-cols-[minmax(280px,0.42fr)_1fr] xl:grid-cols-[minmax(300px,0.4fr)_1fr]">
      <Surface className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-0">
        <div
          className="border-b px-5 py-4"
          style={{
            borderColor: "var(--border)",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--surface)) 0%, var(--surface) 55%)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                {directorySubtitle}
              </p>
              <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-main)] sm:text-xl">
                {directoryTitle}
              </h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[var(--text-soft)]">
                Tap a row to open analytics. Scroll the list for everyone; search and role filters narrow the roster.
              </p>
            </div>
            <span
              className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-soft)",
                color: "var(--text-main)",
              }}
            >
              {members.length} {members.length === 1 ? "member" : "members"}
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
          <div
            className="flex min-h-0 flex-1 flex-col rounded-2xl border p-2 sm:p-2.5"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in srgb, var(--surface-soft) 65%, var(--surface))",
            }}
          >
            <div
              className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5"
              style={{ scrollbarGutter: "stable" }}
            >
              {members.map((member) => (
                <TeamMemberCard
                  key={member.id}
                  member={member}
                  active={member.id === selectedMemberId}
                  onClick={() => onSelect(member.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </Surface>

      <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:h-full">
        {analyticsLoading || !selectedAnalytics ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <StatePanel
              title="Loading team analytics"
              description="Preparing attendance, progress, and work-hour charts for the selected member."
            />
          </div>
        ) : (
          <>
            <Surface className="overflow-hidden p-0">
              <div
                className="border-b px-6 py-6"
                style={{
                  borderColor: "var(--border)",
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--surface)) 0%, var(--surface) 58%)",
                }}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                      Selected team member
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">
                      {selectedAnalytics.user.name}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--text-soft)]">
                      {selectedAnalytics.user.designation || "Team member"} · {formatRole(selectedAnalytics.user.role)} ·{" "}
                      {selectedAnalytics.user.department?.name || "No department"}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">Status</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">
                        {selectedAnalytics.metrics.checkedIn ? "Checked in" : "Offline"}
                      </p>
                    </div>
                    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">Avg hours</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">
                        {selectedAnalytics.metrics.avgDailyHours}h
                      </p>
                    </div>
                    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">Avg progress</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">
                        {selectedAnalytics.metrics.avgProgress}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 px-6 py-6 md:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Assigned tasks",
                    value: selectedAnalytics.metrics.totalTasks,
                  },
                  {
                    label: "Completed",
                    value: selectedAnalytics.metrics.completedTasks,
                  },
                  {
                    label: "Pending",
                    value: selectedAnalytics.metrics.pendingTasks,
                  },
                  {
                    label: "Attendance days",
                    value: selectedAnalytics.metrics.attendanceDays,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border px-4 py-4"
                    style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{item.value}</p>
                  </div>
                ))}
              </div>
            </Surface>

            <div className="grid gap-4 xl:grid-cols-2">
              <LineChartCard
                title="Daily work hours"
                subtitle="Recent working-hour movement for the selected team member."
                values={selectedAnalytics.analytics.workingHoursTrend.map((item) => item.hours)}
                labels={selectedAnalytics.analytics.workingHoursTrend.map((item) => item.label)}
                suffix="h"
                stroke="var(--accent)"
                fill="color-mix(in srgb, var(--accent) 16%, transparent)"
              />
              <LineChartCard
                title="Work progress trend"
                subtitle="Average task progress updates over the last two weeks."
                values={selectedAnalytics.analytics.taskProgressTrend.map((item) => item.avgProgress)}
                labels={selectedAnalytics.analytics.taskProgressTrend.map((item) => item.label)}
                suffix="%"
                stroke="var(--success)"
                fill="color-mix(in srgb, var(--success) 14%, transparent)"
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <HeatmapGrid
                title="Attendance intensity"
                subtitle="Attendance pattern over the past 35 days."
                items={selectedAnalytics.analytics.attendanceHeatmap}
              />
              <StatusBreakdownCard
                title="Task status split"
                items={selectedAnalytics.taskStatusBreakdown}
              />
            </div>

            <Surface className="p-5">
              <div className="mb-4">
                <p className="text-sm font-semibold text-[var(--text-main)]">Recent assigned work</p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  Latest tasks to help leadership review delivery context quickly.
                </p>
              </div>
              {selectedAnalytics.recentTasks.length ? (
                <TaskSummaryList tasks={selectedAnalytics.recentTasks} />
              ) : (
                <StatePanel title="No tasks found" description="This team member does not have assigned tasks yet." />
              )}
            </Surface>
          </>
        )}
      </div>
    </div>
  );
}

function DepartmentWisePanel({
  departments,
}: {
  departments: NonNullable<Extract<DashboardSummary, { scope: "superadmin" | "admin" }>["analytics"]["superAdmin"]>["departmentWise"];
}) {
  return (
    <Surface className="p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold text-[var(--text-main)]">Department-wise analytics</p>
        <p className="mt-1 text-sm text-[var(--text-soft)]">
          Detailed CRM performance by department for CEO-level review.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Members</th>
              <th className="px-3 py-2">Projects</th>
              <th className="px-3 py-2">Tasks</th>
              <th className="px-3 py-2">Completion</th>
              <th className="px-3 py-2">Progress</th>
              <th className="px-3 py-2">Attendance</th>
              <th className="px-3 py-2">Open issues</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((department) => (
              <tr
                key={department.departmentId}
                className="rounded-2xl border"
                style={{ background: "var(--surface-soft)", borderColor: "var(--border)" }}
              >
                <td className="rounded-l-2xl px-3 py-3 text-sm font-semibold text-[var(--text-main)]">
                  {department.departmentName}
                </td>
                <td className="px-3 py-3 text-sm text-[var(--text-soft)]">
                  {department.members} ({department.managers} managers, {department.interns} interns)
                </td>
                <td className="px-3 py-3 text-sm text-[var(--text-soft)]">{department.totalProjects}</td>
                <td className="px-3 py-3 text-sm text-[var(--text-soft)]">
                  {department.completedTasks}/{department.totalTasks}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-[var(--text-main)]">
                  {department.completionRate}%
                </td>
                <td className="px-3 py-3 text-sm text-[var(--text-soft)]">{department.avgProgress}%</td>
                <td className="px-3 py-3 text-sm text-[var(--text-soft)]">
                  {department.activeAttendance} live / {department.avgWorkingHours}h avg
                </td>
                <td className="rounded-r-2xl px-3 py-3 text-sm text-[var(--text-soft)]">{department.openIssues}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

function GoogleWorkspacePanel({
  scope,
  status,
  loading,
  message,
  projects,
  users,
  selectedProjectId,
  actionLoading,
  meetResult,
  sheetResult,
  driveResult,
  onClearMeetResult,
  onClearSheetResult,
  onClearDriveResult,
  onSelectProject,
  onConnect,
  onDisconnect,
  onCreateMeet,
  onCreateSheet,
  onCreateDriveFolder,
  onSetMessage,
}: {
  scope: DashboardSummary["scope"];
  status: GoogleWorkspaceStatus | null;
  loading: boolean;
  message: string;
  projects: Project[];
  users: CRMUser[];
  selectedProjectId: string;
  actionLoading: WorkspaceActionLoading;
  meetResult: GoogleMeetSessionResult | null;
  sheetResult: GoogleProjectSheetResult | null;
  driveResult: GoogleDriveFolderResult | null;
  onClearMeetResult: () => void;
  onClearSheetResult: () => void;
  onClearDriveResult: () => void;
  onSelectProject: (projectId: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onCreateMeet: (attendeeUserIds: string[]) => void;
  onCreateSheet: () => void;
  onCreateDriveFolder: () => void;
  onSetMessage: (value: string) => void;
}) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const [sharingAsset, setSharingAsset] = useState<"" | "meet" | "drive">("");
  const [uploadingDriveFile, setUploadingDriveFile] = useState(false);
  const driveFileInputRef = useRef<HTMLInputElement | null>(null);
  const [meetTargetMode, setMeetTargetMode] = useState<"project" | "department" | "all_departments">("project");
  const [selectedMeetDepartmentId, setSelectedMeetDepartmentId] = useState("");
  const [meetAttendeeQuery, setMeetAttendeeQuery] = useState("");
  const [meetAttendeeRole, setMeetAttendeeRole] = useState<MemberRoleFilter>("ALL");
  const workspaceReady = Boolean(status?.connected);
  const departmentChoices = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of users) {
      if (member.department?.id && member.department?.name) {
        map.set(member.department.id, member.department.name);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);
  const selectedMeetDepartmentName =
    departmentChoices.find((department) => department.id === selectedMeetDepartmentId)?.name || "";
  const computedAudienceIds = useMemo(() => {
    if (meetTargetMode === "project") {
      if (!selectedProject?.departmentId) {
        return [];
      }
      return users.filter((member) => member.departmentId === selectedProject.departmentId).map((member) => member.id);
    }
    if (meetTargetMode === "department") {
      if (!selectedMeetDepartmentId) {
        return [];
      }
      return users.filter((member) => member.departmentId === selectedMeetDepartmentId).map((member) => member.id);
    }
    return users.filter((member) => Boolean(member.departmentId)).map((member) => member.id);
  }, [
    meetTargetMode,
    selectedMeetDepartmentId,
    selectedProject?.departmentId,
    users,
  ]);
  const meetAudienceMembers = useMemo(
    () => users.filter((member) => computedAudienceIds.includes(member.id)),
    [users, computedAudienceIds]
  );
  const meetAttendeeRoleOptions = useMemo(
    () => sortedUniqueRoles(meetAudienceMembers),
    [meetAudienceMembers]
  );
  const filteredMeetAudience = useMemo(
    () =>
      filterMembersForPicker(meetAudienceMembers, {
        searchQuery: meetAttendeeQuery,
        roleFilter: meetAttendeeRole,
      }),
    [meetAudienceMembers, meetAttendeeQuery, meetAttendeeRole]
  );
  const workspaceBadgeLabel = status?.connected
    ? "Connected"
    : status?.setupRequired
      ? "Setup Required"
      : status && status.oauthConfigured === false
        ? "OAuth Not Configured"
        : "Not Connected";
  const workspaceBadgeStyles = status?.connected
    ? { background: "color-mix(in srgb, var(--success) 16%, var(--surface))", color: "var(--success)" }
    : status?.setupRequired
      ? { background: "color-mix(in srgb, #f59e0b 16%, var(--surface))", color: "#b45309" }
      : status && status.oauthConfigured === false
        ? { background: "color-mix(in srgb, #ef4444 16%, var(--surface))", color: "#b91c1c" }
        : { background: "var(--surface-soft)", color: "var(--text-soft)" };

  const shareAssetToChat = async (service: "meet" | "drive") => {
    const resultProjectId = service === "meet" ? meetResult?.project?.id : driveResult?.project?.id;
    if (!resultProjectId) {
      onSetMessage("Generate the asset first before sharing to chat.");
      return;
    }

    const content =
      service === "meet"
        ? [
            `Google Meet session created for ${meetResult?.project?.name ?? "the project"}.`,
            meetResult?.meetUrl ? `Meet: ${meetResult.meetUrl}` : null,
            meetResult?.eventUrl ? `Calendar event: ${meetResult.eventUrl}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        : [
            `Google Drive workspace created for ${driveResult?.project?.name ?? "the project"}.`,
            driveResult?.folderUrl ? `Folder: ${driveResult.folderUrl}` : null,
            driveResult?.summaryFileUrl ? `Summary file: ${driveResult.summaryFileUrl}` : null,
          ]
            .filter(Boolean)
            .join("\n");

    try {
      setSharingAsset(service);
      await apiPost("/chat/messages", {
        channelType: "PROJECT",
        channelId: resultProjectId,
        content,
        messageType: "TEXT",
      });
      onSetMessage(`Shared ${service === "meet" ? "Meet link" : "Drive links"} to project chat.`);
    } catch (err) {
      onSetMessage(normalizeErrorMessage(err, "Failed to share asset to chat."));
    } finally {
      setSharingAsset("");
    }
  };

  const onDriveFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFile = event.target.files?.[0];
    event.target.value = "";

    if (!pickedFile) {
      return;
    }

    if (!driveResult?.folderId || !driveResult?.project?.id) {
      onSetMessage("Create a Drive workspace first before uploading files.");
      return;
    }

    try {
      setUploadingDriveFile(true);
      const formData = new FormData();
      formData.append("file", pickedFile);
      formData.append("folderId", driveResult.folderId);
      formData.append("projectId", driveResult.project.id);

      const uploaded = await apiPostForm<GoogleDriveUploadResult>("/integrations/google/drive/upload", formData);
      onSetMessage(
        `Uploaded ${uploaded.fileName} to ${driveResult.project.name}${uploaded.fileUrl ? `. Open: ${uploaded.fileUrl}` : "."}`
      );
    } catch (err) {
      onSetMessage(normalizeErrorMessage(err, "Failed to upload file to Drive workspace."));
    } finally {
      setUploadingDriveFile(false);
    }
  };

  if (loading) {
    return (
      <StatePanel
        title="Loading Google Workspace"
        description="Checking Google Meet, Sheets, and Drive connection status."
      />
    );
  }

  return (
    <div className="space-y-4">
      {message ? <StatePanel title="Workspace update" description={message} /> : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Surface className="p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text-main)]">Google Workspace connection</p>
            <span
              className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={workspaceBadgeStyles}
            >
              {workspaceBadgeLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--text-soft)]">
            Connect once with Google Auth and manage Meet, Sheets, and Drive directly from CRM workflows.
          </p>
          {status?.setupRequired ? (
            <p className="mt-2 text-xs font-medium text-amber-700">
              {status.setupMessage || "Workspace setup is incomplete. Run migrations and recheck status."}
            </p>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { key: "meet", label: "Google Meet", connected: status?.services.meet ?? false },
              { key: "sheets", label: "Google Sheets", connected: status?.services.sheets ?? false },
              { key: "drive", label: "Google Drive", connected: status?.services.drive ?? false },
            ].map((service) => (
              <div
                key={service.key}
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  {service.label}
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                  {service.connected ? "Connected" : "Not connected"}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConnect}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--accent)" }}
            >
              Connect with Google Auth
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
            >
              Disconnect
            </button>
          </div>
          <p className="mt-3 text-xs text-[var(--text-faint)]">
            {status?.connected
              ? `Connected as ${status.workspaceEmail || "Google account"}`
              : "No workspace account connected yet."}
          </p>
        </Surface>

        <Surface className="p-5">
          <p className="text-sm font-semibold text-[var(--text-main)]">Workspace + CRM quick signals</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-faint)]">Total tasks</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{status?.crmSignals.totalTasks ?? 0}</p>
            </div>
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-faint)]">Open tasks</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{status?.crmSignals.openTasks ?? 0}</p>
            </div>
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-faint)]">Projects</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{status?.crmSignals.totalProjects ?? 0}</p>
            </div>
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-faint)]">Departments</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{status?.crmSignals.totalDepartments ?? 0}</p>
            </div>
          </div>
        </Surface>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Surface className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--text-main)]">Workspace actions</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">
                Launch Google Meet sessions, project Sheets, and Drive folders directly from CRM data.
              </p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{
                background: workspaceReady
                  ? "color-mix(in srgb, var(--success) 14%, var(--surface))"
                  : "var(--surface-soft)",
                color: workspaceReady ? "var(--success)" : "var(--text-soft)",
              }}
            >
              {workspaceReady ? "Ready" : "Connect first"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  Project
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(event) => onSelectProject(event.target.value)}
                  className="mt-2 h-12 w-full rounded-2xl border px-4 text-sm outline-none"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface-soft)",
                    color: "var(--text-main)",
                  }}
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() => onCreateMeet(computedAudienceIds)}
                  disabled={
                    !workspaceReady ||
                    actionLoading === "meet" ||
                    (meetTargetMode === "project" && !selectedProjectId)
                  }
                  className="rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: "var(--accent)" }}
                >
                  {actionLoading === "meet" ? "Creating Meet session..." : "Create Meet session"}
                </button>
                <button
                  type="button"
                  onClick={onCreateSheet}
                  disabled={!workspaceReady || !selectedProjectId || actionLoading === "sheets"}
                  className="rounded-2xl border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                >
                  {actionLoading === "sheets" ? "Exporting Sheet..." : "Export project to Sheets"}
                </button>
                <button
                  type="button"
                  onClick={onCreateDriveFolder}
                  disabled={!workspaceReady || !selectedProjectId || actionLoading === "drive"}
                  className="rounded-2xl border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                >
                  {actionLoading === "drive" ? "Creating Drive folder..." : "Create Drive workspace"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  Selected project snapshot
                </p>
                {selectedProject ? (
                  <>
                    <p className="mt-3 text-lg font-semibold text-[var(--text-main)]">{selectedProject.name}</p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      {selectedProject.department?.name || "No department"} | Owner: {selectedProject.owner?.name || "Not assigned"}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Progress</p>
                        <p className="mt-1 text-base font-semibold text-[var(--text-main)]">{selectedProject.progress}%</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Tasks</p>
                        <p className="mt-1 text-base font-semibold text-[var(--text-main)]">{selectedProject.taskCounts.total}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Open</p>
                        <p className="mt-1 text-base font-semibold text-[var(--text-main)]">
                          {selectedProject.taskCounts.todo + selectedProject.taskCounts.inProgress}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-[var(--text-soft)]">
                    Choose a project to generate Google Workspace assets around it.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                    Meet attendees
                  </p>
                  <span className="text-xs text-[var(--text-soft)]">
                    {filteredMeetAudience.length === meetAudienceMembers.length
                      ? `${meetAudienceMembers.length} members`
                      : `${filteredMeetAudience.length} of ${meetAudienceMembers.length} shown`}
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                    Meet for
                  </label>
                  <select
                    value={meetTargetMode}
                    onChange={(event) =>
                      setMeetTargetMode(event.target.value as "project" | "department" | "all_departments")
                    }
                    className="h-11 w-full rounded-2xl border px-3 text-sm outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
                  >
                    <option value="project">Selected project department</option>
                    <option value="department">Single department</option>
                    <option value="all_departments">All departments</option>
                  </select>
                  {meetTargetMode === "department" ? (
                    <select
                      value={selectedMeetDepartmentId}
                      onChange={(event) => setSelectedMeetDepartmentId(event.target.value)}
                      className="h-11 w-full rounded-2xl border px-3 text-sm outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
                    >
                      <option value="">Select department</option>
                      {departmentChoices.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-[var(--text-soft)]">
                  {meetTargetMode === "project"
                    ? selectedProject?.department?.name
                      ? `Will invite all members in ${selectedProject.department.name}.`
                      : "This project has no department, so there are no auto-invites. You can still create a Meet link, or change “Meet for” above."
                    : meetTargetMode === "department"
                      ? selectedMeetDepartmentName
                        ? `Will invite all members in ${selectedMeetDepartmentName}.`
                        : "Select a department."
                      : "Will invite all members from all departments."}
                </p>
                <div className="mt-3">
                  <MemberPickerToolbar
                    searchQuery={meetAttendeeQuery}
                    onSearchChange={setMeetAttendeeQuery}
                    roleFilter={meetAttendeeRole}
                    onRoleFilterChange={setMeetAttendeeRole}
                    roleOptions={meetAttendeeRoleOptions}
                  />
                </div>
                <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto pr-1">
                  {filteredMeetAudience.length === 0 ? (
                    <p className="rounded-2xl border px-3 py-4 text-sm text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>
                      No people match this search. Clear filters to see the full attendee list.
                    </p>
                  ) : (
                    filteredMeetAudience.map((member) => {
                      return (
                        <label
                          key={member.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-sm"
                          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--text-main)]">{member.name}</p>
                            <p className="truncate text-xs text-[var(--text-soft)]">{member.email}</p>
                          </div>
                          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                            {formatRole(member.role)}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </Surface>

        <Surface className="p-5">
          <p className="text-sm font-semibold text-[var(--text-main)]">Latest generated assets</p>
          <div className="mt-4 space-y-3">
            {meetResult ? (
              <article className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                <p className="text-sm font-semibold text-[var(--text-main)]">Meet session ready</p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  {(meetResult.project?.name || "Department meeting")} | {new Date(meetResult.startAt).toLocaleString()}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {meetResult.meetUrl ? (
                    <a
                      href={meetResult.meetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl px-3 py-2 text-sm font-semibold text-white"
                      style={{ background: "var(--accent)" }}
                    >
                      Open Meet
                    </a>
                  ) : null}
                  {meetResult.eventUrl ? (
                    <a
                      href={meetResult.eventUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border px-3 py-2 text-sm font-semibold"
                      style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                    >
                      Open Calendar event
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void shareAssetToChat("meet")}
                    disabled={sharingAsset === "meet"}
                    className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                  >
                    {sharingAsset === "meet" ? "Sharing..." : "Share to chat"}
                  </button>
                  <button
                    type="button"
                    onClick={onClearMeetResult}
                    className="rounded-xl border px-3 py-2 text-sm font-semibold text-rose-600"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ) : null}

            {sheetResult ? (
              <article className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                <p className="text-sm font-semibold text-[var(--text-main)]">Sheet exported</p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">
                  {sheetResult.project.name} | {sheetResult.rowCount} rows written
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={sheetResult.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-xl px-3 py-2 text-sm font-semibold text-white"
                    style={{ background: "var(--accent)" }}
                  >
                    Open Sheet
                  </a>
                  <button
                    type="button"
                    onClick={onClearSheetResult}
                    className="rounded-xl border px-3 py-2 text-sm font-semibold text-rose-600"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ) : null}

            {driveResult ? (
              <article className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                <p className="text-sm font-semibold text-[var(--text-main)]">Drive workspace created</p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">{driveResult.project.name}</p>
                <input
                  ref={driveFileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => void onDriveFilePicked(event)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={
                      driveResult.folderUrl ||
                      `https://drive.google.com/drive/folders/${driveResult.folderId}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl px-3 py-2 text-sm font-semibold text-white"
                    style={{ background: "var(--accent-strong)" }}
                  >
                    Open Drive
                  </a>
                  {driveResult.folderUrl ? (
                    <a
                      href={driveResult.folderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl px-3 py-2 text-sm font-semibold text-white"
                      style={{ background: "var(--accent)" }}
                    >
                      Open folder
                    </a>
                  ) : null}
                  {driveResult.summaryFileUrl ? (
                    <a
                      href={driveResult.summaryFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border px-3 py-2 text-sm font-semibold"
                      style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                    >
                      Open summary file
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => driveFileInputRef.current?.click()}
                    disabled={uploadingDriveFile}
                    className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                  >
                    {uploadingDriveFile ? "Uploading..." : "Upload file"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareAssetToChat("drive")}
                    disabled={sharingAsset === "drive"}
                    className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                  >
                    {sharingAsset === "drive" ? "Sharing..." : "Share to chat"}
                  </button>
                  <button
                    type="button"
                    onClick={onClearDriveResult}
                    className="rounded-xl border px-3 py-2 text-sm font-semibold text-rose-600"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ) : null}

            {!meetResult && !sheetResult && !driveResult ? (
              <p className="text-sm text-[var(--text-soft)]">
                Generated Google assets will appear here after you run a Workspace action.
              </p>
            ) : null}
          </div>
        </Surface>
      </div>

      <Surface className="p-5">
        <p className="text-sm font-semibold text-[var(--text-main)]">Recommended Google Workspace analytics for CRM</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(status?.recommendations ?? []).map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border px-4 py-3"
              style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
            >
              <p className="text-sm font-semibold text-[var(--text-main)]">{item.title}</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">{item.description}</p>
              <p className="mt-2 text-xs text-[var(--text-faint)]">
                Source: {item.source} | CRM value: {item.crmUseCase}
              </p>
            </article>
          ))}
        </div>
      </Surface>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading, error: sessionError, retry: retrySession } = useSession();
  const { globalSearch, setGlobalSearch } = useCrmSearch();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [teamMembers, setTeamMembers] = useState<CRMUser[]>([]);
  const [teamDirectoryRoleFilter, setTeamDirectoryRoleFilter] = useState<MemberRoleFilter>("ALL");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedAnalytics, setSelectedAnalytics] = useState<UserAnalyticsSummary | null>(null);
  const [teamAnalyticsList, setTeamAnalyticsList] = useState<UserAnalyticsSummary[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState<GoogleWorkspaceStatus | null>(null);
  const [workspaceProjects, setWorkspaceProjects] = useState<Project[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<CRMUser[]>([]);
  const [selectedWorkspaceProjectId, setSelectedWorkspaceProjectId] = useState("");
  const [workspaceActionLoading, setWorkspaceActionLoading] = useState<WorkspaceActionLoading>("");
  const [meetResult, setMeetResult] = useState<GoogleMeetSessionResult | null>(null);
  const [sheetResult, setSheetResult] = useState<GoogleProjectSheetResult | null>(null);
  const [driveResult, setDriveResult] = useState<GoogleDriveFolderResult | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [activeDashboardTab, setActiveDashboardTab] = useState<"analytics" | "workspace">("analytics");
  const [error, setError] = useState("");

  const leadershipView = summary?.scope === "admin" || summary?.scope === "superadmin";

  const teamDirectoryRoleOptions = useMemo(() => sortedUniqueRoles(teamMembers), [teamMembers]);
  const filteredTeamMembers = useMemo(
    () =>
      filterMembersForPicker(teamMembers, {
        searchQuery: globalSearch,
        roleFilter: teamDirectoryRoleFilter,
      }),
    [teamMembers, globalSearch, teamDirectoryRoleFilter]
  );

  useEffect(() => {
    if (!leadershipView) {
      return;
    }
    setSelectedMemberId((current) => {
      if (filteredTeamMembers.some((member) => member.id === current)) {
        return current;
      }
      return filteredTeamMembers[0]?.id ?? "";
    });
  }, [leadershipView, filteredTeamMembers]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const targetSection = params.get("tab");
    if (targetSection === "workspace") {
      setActiveDashboardTab("workspace");
    }

    const googleState = params.get("google");
    if (googleState === "connected") {
      setWorkspaceMessage("Google Workspace connected successfully.");
    } else if (googleState === "denied") {
      setWorkspaceMessage("Google connection was cancelled from consent screen.");
    } else if (googleState === "missing_config") {
      setWorkspaceMessage("Google OAuth config is missing in backend environment.");
    } else if (googleState === "token_failed" || googleState === "failed") {
      setWorkspaceMessage("Google token exchange failed. Please retry connection.");
    } else if (googleState === "missing_code") {
      setWorkspaceMessage("Google callback was incomplete. Please retry.");
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const raw = window.localStorage.getItem(workspaceAssetsStorageKey(user.id));
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        meetResult?: GoogleMeetSessionResult | null;
        sheetResult?: GoogleProjectSheetResult | null;
        driveResult?: GoogleDriveFolderResult | null;
      };
      setMeetResult(parsed.meetResult ?? null);
      setSheetResult(parsed.sheetResult ?? null);
      setDriveResult(parsed.driveResult ?? null);
    } catch {
      setMeetResult(null);
      setSheetResult(null);
      setDriveResult(null);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    window.localStorage.setItem(
      workspaceAssetsStorageKey(user.id),
      JSON.stringify({
        meetResult,
        sheetResult,
        driveResult,
      })
    );
  }, [user, meetResult, sheetResult, driveResult]);

  useEffect(() => {
    async function loadSummary() {
      try {
        const data = await apiGet<DashboardSummary>("/dashboard/summary");
        setSummary(data);
        setError("");
      } catch (err) {
        setError(normalizeErrorMessage(err, "Failed to load dashboard"));
      }
    }

    if (user) {
      void loadSummary();
    }
  }, [user]);

  useEffect(() => {
    async function loadTeamMembers() {
      if (!leadershipView) {
        setTeamAnalyticsList([]);
        return;
      }

      try {
        setTeamLoading(true);
        const membersPage = await apiGet<{ items: CRMUser[] }>("/users?paginate=true&limit=120&offset=0");
        const members = membersPage.items;
        const visibleMembers =
          summary?.scope === "superadmin"
            ? members.filter((member) =>
                ["ADMIN", "MANAGER", "EMPLOYEE", "INTERN"].includes(member.role)
              )
            : members.filter((member) => member.role === "EMPLOYEE" || member.role === "INTERN");
        setTeamMembers(visibleMembers);
        setSelectedMemberId((current) => current || visibleMembers[0]?.id || "");
        const analyticsList = await Promise.all(
          visibleMembers.slice(0, TEAM_ANALYTICS_PRELOAD_LIMIT).map(async (member) =>
            apiGet<UserAnalyticsSummary>(`/users/${member.id}/analytics`)
          )
        );
        setTeamAnalyticsList(analyticsList);
      } catch (err) {
        setError(normalizeErrorMessage(err, "Failed to load team members"));
      } finally {
        setTeamLoading(false);
      }
    }

    void loadTeamMembers();
  }, [leadershipView, summary?.scope]);

  useEffect(() => {
    async function loadMemberAnalytics() {
      if (!leadershipView || !selectedMemberId) {
        setSelectedAnalytics(null);
        return;
      }

      try {
        setAnalyticsLoading(true);
        const data = await apiGet<UserAnalyticsSummary>(`/users/${selectedMemberId}/analytics`);
        setSelectedAnalytics(data);
      } catch (err) {
        setError(normalizeErrorMessage(err, "Failed to load member analytics"));
      } finally {
        setAnalyticsLoading(false);
      }
    }

    void loadMemberAnalytics();
  }, [leadershipView, selectedMemberId]);

  useEffect(() => {
    async function loadWorkspaceStatus() {
      if (!summary || !canUseGoogleWorkspace(summary.scope)) {
        setWorkspaceStatus(null);
        setWorkspaceProjects([]);
        setWorkspaceUsers([]);
        setSelectedWorkspaceProjectId("");
        return;
      }

      try {
        setWorkspaceLoading(true);
        const [statusData, projectPage, userPage] = await Promise.all([
          apiGet<GoogleWorkspaceStatus>("/integrations/google/status"),
          apiGet<{ items: Project[] }>("/projects?paginate=true&limit=100&offset=0"),
          apiGet<{ items: CRMUser[] }>("/users?paginate=true&limit=120&offset=0"),
        ]);
        const projectData = projectPage.items;
        const userData = userPage.items;
        setWorkspaceStatus(statusData);
        setWorkspaceProjects(projectData);
        setWorkspaceUsers(userData);
        setSelectedWorkspaceProjectId((current) => current || projectData[0]?.id || "");
      } catch (err) {
        setWorkspaceStatus(null);
        setWorkspaceProjects([]);
        setWorkspaceUsers([]);
        setWorkspaceMessage(
          normalizeErrorMessage(err, "Failed to load Google Workspace status")
        );
      } finally {
        setWorkspaceLoading(false);
      }
    }

    void loadWorkspaceStatus();
  }, [summary?.scope]);

  useRealtimeRefresh(
    user,
    ["task:updated", "attendance:updated", "org:updated", "issue:updated", "project:updated"],
    async () => {
      if (!user) {
        return;
      }

      const freshSummary = await apiGet<DashboardSummary>("/dashboard/summary");
      setSummary(freshSummary);

      if (freshSummary.scope === "admin" || freshSummary.scope === "superadmin") {
        const membersPage = await apiGet<{ items: CRMUser[] }>("/users?paginate=true&limit=120&offset=0");
        const members = membersPage.items;
        const visibleMembers =
          freshSummary.scope === "superadmin"
            ? members.filter((member) =>
                ["ADMIN", "MANAGER", "EMPLOYEE", "INTERN"].includes(member.role)
              )
            : members.filter((member) => member.role === "EMPLOYEE" || member.role === "INTERN");
        setTeamMembers(visibleMembers);
        const analyticsList = await Promise.all(
          visibleMembers.slice(0, TEAM_ANALYTICS_PRELOAD_LIMIT).map(async (member) =>
            apiGet<UserAnalyticsSummary>(`/users/${member.id}/analytics`)
          )
        );
        setTeamAnalyticsList(analyticsList);

        const nextSelectedId =
          visibleMembers.find((member) => member.id === selectedMemberId)?.id ??
          visibleMembers[0]?.id ??
          "";
        setSelectedMemberId(nextSelectedId);

        if (nextSelectedId) {
          const analytics = await apiGet<UserAnalyticsSummary>(`/users/${nextSelectedId}/analytics`);
          setSelectedAnalytics(analytics);
        }
      }

      if (canUseGoogleWorkspace(freshSummary.scope)) {
        try {
          const [workspace, projectPage, userPage] = await Promise.all([
            apiGet<GoogleWorkspaceStatus>("/integrations/google/status"),
            apiGet<{ items: Project[] }>("/projects?paginate=true&limit=100&offset=0"),
            apiGet<{ items: CRMUser[] }>("/users?paginate=true&limit=120&offset=0"),
          ]);
          const projects = projectPage.items;
          const users = userPage.items;
          setWorkspaceStatus(workspace);
          setWorkspaceProjects(projects);
          setWorkspaceUsers(users);
          setSelectedWorkspaceProjectId((current) => current || projects[0]?.id || "");
        } catch (err) {
          setWorkspaceStatus(null);
          setWorkspaceProjects([]);
          setWorkspaceUsers([]);
          setWorkspaceMessage(
            normalizeErrorMessage(err, "Failed to refresh Google Workspace status")
          );
        }
      } else {
        setTeamAnalyticsList([]);
        setWorkspaceStatus(null);
        setWorkspaceProjects([]);
        setWorkspaceUsers([]);
      }
    }
  );

  const overviewStats = useMemo(() => {
    if (!summary) {
      return [];
    }

    const progressSeries = summary.analytics.taskProgressTrend.map((item) => item.avgProgress);
    const attendanceSeries =
      summary.scope === "employee"
        ? summary.analytics.workingHoursTrend.map((item) => item.hours)
        : summary.analytics.attendanceHeatmap.map((item) => item.value);
    const hoursSeries = summary.analytics.workingHoursTrend.map((item) => item.hours);

    if (summary.scope === "superadmin") {
      return [
        {
          label: "Departments",
          value: summary.metrics.totalDepartments,
          helper: "Active business units",
          points: attendanceSeries.slice(-7),
        },
        {
          label: "Managers",
          value: summary.metrics.totalManagers,
          helper: "Leadership coverage",
          points: progressSeries.slice(-7),
        },
        {
          label: "Employees",
          value: summary.metrics.totalEmployees,
          helper: "Core execution team",
          points: hoursSeries.slice(-7),
        },
        {
          label: "Interns",
          value: summary.metrics.totalInterns,
          helper: "Learning pipeline",
          points: progressSeries.slice(-7).reverse(),
        },
      ];
    }

    if (summary.scope === "admin") {
      return [
        {
          label: "Employees",
          value: summary.metrics.totalEmployees,
          helper: "Employees and managers",
          points: attendanceSeries.slice(-7),
        },
        {
          label: "Interns",
          value: summary.metrics.totalInterns,
          helper: "Current intern roster",
          points: hoursSeries.slice(-7),
        },
        {
          label: "Tasks",
          value: summary.metrics.totalTasks,
          helper: "Tracked organization tasks",
          points: progressSeries.slice(-7),
        },
        {
          label: "Live attendance",
          value: summary.metrics.activeAttendance,
          helper: "Checked in right now",
          points: attendanceSeries.slice(-7).reverse(),
        },
      ];
    }

    const employeeMetrics = (summary as EmployeeDashboardSummary).metrics;

    return [
      {
        label: "Assigned",
        value: employeeMetrics.myTasks,
        helper: "Tasks in your queue",
        points: progressSeries.slice(-7),
      },
      {
        label: "Pending",
        value: employeeMetrics.pendingTasks,
        helper: "Open work items",
        points: attendanceSeries.slice(-7),
      },
      {
        label: "Done",
        value: employeeMetrics.completedTasks,
        helper: "Completed items",
        points: progressSeries.slice(-7).reverse(),
      },
      {
        label: "Status",
        value: employeeMetrics.checkedIn ? "Active" : "Offline",
        helper: "Attendance state",
        points: hoursSeries.slice(-7),
      },
    ];
  }, [summary]);

  const sessionGate = renderSessionGate({
    loading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading workspace",
    loadingDescription: "Preparing your CRM dashboard.",
  });
  if (sessionGate) {
    return sessionGate;
  }

  if (!user) {
    return null;
  }

  if (error || !summary) {
    return (
      <CRMShell user={user}>
        <StatePanel title="Dashboard unavailable" description={error || "No summary data returned yet."} />
      </CRMShell>
    );
  }

  const completionRate =
    summary.scope === "employee"
      ? Math.round(
          (((summary as EmployeeDashboardSummary).metrics.completedTasks || 0) /
            Math.max(1, (summary as EmployeeDashboardSummary).metrics.myTasks)) *
            100
        )
      : Math.round((summary.metrics.completedTasks / Math.max(1, summary.metrics.totalTasks)) * 100);

  const heroHoursValue = summary.analytics.workingHoursTrend.at(-1)?.hours ?? 0;
  const totalWorkforce =
    summary.scope === "employee" ? 1 : summary.metrics.totalEmployees + summary.metrics.totalInterns;
  const activeAttendance =
    summary.scope === "employee" ? ((summary as EmployeeDashboardSummary).metrics.checkedIn ? 1 : 0) : summary.metrics.activeAttendance;
  const inactiveAttendance = Math.max(0, totalWorkforce - activeAttendance);
  const totalTasks =
    summary.scope === "employee"
      ? (summary as EmployeeDashboardSummary).metrics.myTasks
      : summary.metrics.totalTasks;
  const completedTasks = summary.metrics.completedTasks;
  const remainingTasks = Math.max(0, totalTasks - completedTasks);
  const inProgressEstimate = Math.min(remainingTasks, Math.round(remainingTasks * 0.55));
  const pendingEstimate = Math.max(0, remainingTasks - inProgressEstimate);
  const departmentPieItems =
    summary.scope === "employee"
      ? []
      : summary.departmentPerformance
          .filter((department) => department.completed > 0)
          .sort((a, b) => b.completed - a.completed)
          .slice(0, 6)
          .map((department, index) => ({
            label: department.departmentName,
            value: department.completed,
            color: [
              "var(--accent-strong)",
              "var(--accent)",
              "var(--success)",
              "#f59e0b",
              "#06b6d4",
              "#f97316",
            ][index] ?? "var(--text-faint)",
          }));
  const attendanceRate = Math.round((activeAttendance / Math.max(1, totalWorkforce)) * 100);
  const latestProgress = summary.analytics.taskProgressTrend.at(-1)?.avgProgress ?? 0;
  const previousProgress =
    summary.analytics.taskProgressTrend.length > 1
      ? summary.analytics.taskProgressTrend.at(-2)?.avgProgress ?? latestProgress
      : latestProgress;
  const progressDelta = Math.round((latestProgress - previousProgress) * 10) / 10;
  const bestDepartment =
    summary.scope === "employee" || summary.departmentPerformance.length === 0
      ? null
      : [...summary.departmentPerformance].sort((a, b) => b.averageProgress - a.averageProgress)[0];
  const movingAverageCompletion = (() => {
    const trend = summary.analytics.taskProgressTrend;
    if (!trend.length) {
      return 0;
    }
    const window = trend.slice(-5);
    const avg = window.reduce((sum, item) => sum + item.completed, 0) / window.length;
    return Math.max(0, avg);
  })();
  const forecastCompleted = Math.round(completedTasks + movingAverageCompletion);
  const forecastCompletionRate = Math.round((forecastCompleted / Math.max(1, totalTasks)) * 100);
  const teamProductivityScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        completionRate * 0.5 +
          attendanceRate * 0.3 +
          Math.max(0, Math.min(100, 50 + progressDelta * 5)) * 0.2
      )
    )
  );
  const riskAlerts = (() => {
    const alerts: Array<{ id: string; label: string; detail: string; severity: "high" | "medium" }> = [];
    if (attendanceRate < 65) {
      alerts.push({
        id: "attendance",
        label: "Low live attendance",
        detail: `Current attendance is ${attendanceRate}% which may impact delivery.`,
        severity: "high",
      });
    }
    if (completionRate < 55) {
      alerts.push({
        id: "completion",
        label: "Completion is below target",
        detail: `Current completion is ${completionRate}%. Review blocked tasks and owners.`,
        severity: "high",
      });
    }
    if (progressDelta < 0) {
      alerts.push({
        id: "momentum",
        label: "Negative momentum",
        detail: `Progress changed by ${progressDelta}%. Throughput is slowing down.`,
        severity: "medium",
      });
    }
    if (summary.scope !== "employee" && bestDepartment && bestDepartment.averageProgress < 50) {
      alerts.push({
        id: "department",
        label: "Department performance dip",
        detail: `${bestDepartment.departmentName} is leading but still below 50% average progress.`,
        severity: "medium",
      });
    }
    return alerts;
  })();
  const performerRankings = teamAnalyticsList
    .map((member) => {
      const memberCompletion =
        Math.round((member.metrics.completedTasks / Math.max(1, member.metrics.totalTasks)) * 100);
      const memberAttendance = Math.round((member.metrics.attendanceDays / 30) * 100);
      const memberScore = Math.round(
        member.metrics.avgProgress * 0.45 + memberCompletion * 0.35 + Math.min(100, memberAttendance) * 0.2
      );
      return {
        id: member.user.id,
        name: member.user.name,
        role: formatRole(member.user.role),
        score: memberScore,
      };
    })
    .sort((a, b) => b.score - a.score);
  const topPerformers = performerRankings.slice(0, 5);
  const needsSupport = [...performerRankings].reverse().slice(0, 5);
  const recentTrend = summary.analytics.taskProgressTrend.slice(-7);
  const insightItems = [
    {
      label: "Execution pace",
      value:
        progressDelta > 0
          ? `Up ${Math.abs(progressDelta)}% vs last day`
          : progressDelta < 0
            ? `Down ${Math.abs(progressDelta)}% vs last day`
            : "Stable vs last day",
      tone: (progressDelta > 0 ? "positive" : progressDelta < 0 ? "warning" : "neutral") as
        | "neutral"
        | "positive"
        | "warning",
    },
    {
      label: "Attendance pulse",
      value: `${attendanceRate}% live participation`,
      tone: (attendanceRate >= 75 ? "positive" : attendanceRate <= 55 ? "warning" : "neutral") as
        | "neutral"
        | "positive"
        | "warning",
    },
    {
      label: "Throughput forecast",
      value: `${forecastCompleted} completed by next week`,
      tone: (forecastCompletionRate >= completionRate ? "positive" : "neutral") as
        | "neutral"
        | "positive"
        | "warning",
    },
  ];

  const handleGoogleConnect = async () => {
    try {
      const data = await apiGet<{ authUrl: string }>("/integrations/google/auth-url?services=meet,sheets,drive");
      window.location.href = data.authUrl;
    } catch (err) {
      setWorkspaceMessage(normalizeErrorMessage(err, "Failed to start Google Auth flow."));
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      await apiDelete<void>("/integrations/google/disconnect");
      setWorkspaceMessage("Google Workspace disconnected.");
      setMeetResult(null);
      setSheetResult(null);
      setDriveResult(null);
      const refreshed = await apiGet<GoogleWorkspaceStatus>("/integrations/google/status");
      setWorkspaceStatus(refreshed);
    } catch (err) {
      setWorkspaceMessage(normalizeErrorMessage(err, "Failed to disconnect Google Workspace."));
    }
  };

  const runWorkspaceAction = async (
    service: WorkspaceActionLoading,
    attendeeUserIds: string[] = []
  ) => {
    if ((service === "sheets" || service === "drive") && !selectedWorkspaceProjectId) {
      setWorkspaceMessage("Pick a project before creating a Google Workspace asset.");
      return;
    }

    try {
      setWorkspaceActionLoading(service);
      setWorkspaceMessage("");

      if (service === "meet") {
        const result = await apiPost<GoogleMeetSessionResult>("/integrations/google/meet/session", {
          projectId: selectedWorkspaceProjectId || undefined,
          attendeeUserIds,
        });
        setMeetResult(result);
        setWorkspaceMessage(`Meet session created${result.project?.name ? ` for ${result.project.name}` : ""}.`);
      }

      if (service === "sheets") {
        const result = await apiPost<GoogleProjectSheetResult>("/integrations/google/sheets/project-report", {
          projectId: selectedWorkspaceProjectId,
        });
        setSheetResult(result);
        setWorkspaceMessage(`Project report exported to Google Sheets for ${result.project.name}.`);
      }

      if (service === "drive") {
        const result = await apiPost<GoogleDriveFolderResult>("/integrations/google/drive/project-folder", {
          projectId: selectedWorkspaceProjectId,
        });
        setDriveResult(result);
        setWorkspaceMessage(`Drive workspace created for ${result.project.name}.`);
      }
    } catch (err) {
      setWorkspaceMessage(normalizeErrorMessage(err, "Google Workspace action failed."));
    } finally {
      setWorkspaceActionLoading("");
    }
  };

  return (
    <CRMShell user={user}>
      <div className="space-y-5">
        <Surface className="overflow-hidden p-0">
          <div className="grid gap-6 px-6 py-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">
                {summary.scope === "superadmin"
                  ? "CEO command center"
                  : summary.scope === "admin"
                    ? "Admin command center"
                    : "Personal command center"}
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text-main)]">
                Welcome back, {user.name.split(" ")[0]}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
                {leadershipView
                  ? "Track live organization health, review employee and intern performance, and drill into attendance, working hours, and progress from one cleaner dashboard."
                  : "See your attendance, working hours, task movement, and daily progress in a more visual workspace."}
              </p>

              <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
                <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Focus</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">
                    {leadershipView ? "Operations" : "My work"}
                  </p>
                </div>
                <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Flow</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">Scroll workspace</p>
                </div>
                <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Mode</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{formatRole(user.role)}</p>
                </div>
              </div>
            </div>

            <div
              className="rounded-[24px] border p-5"
              style={{
                borderColor: "var(--border)",
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--surface)) 0%, var(--surface-soft) 100%)",
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">Completion rate</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--text-main)]">{completionRate}%</p>
                  <p className="mt-2 text-sm text-[var(--text-soft)]">
                    {leadershipView ? "Org-level task completion snapshot" : "Your completed work snapshot"}
                  </p>
                </div>
                <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">Latest work hours</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--text-main)]">{heroHoursValue}h</p>
                  <p className="mt-2 text-sm text-[var(--text-soft)]">
                    {leadershipView ? "Average recent working-hour trend" : "Your latest tracked work-hour signal"}
                  </p>
                </div>
              </div>

              <div
                className="mt-4 rounded-[20px] border p-4"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <p className="text-sm font-semibold text-[var(--text-main)]">Momentum</p>
                <p className="mt-1 text-sm text-[var(--text-soft)]">Recent progress trend across the workspace.</p>
                <div className="mt-3 h-24 overflow-hidden rounded-xl border p-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                  <svg viewBox="0 0 360 80" className="h-full w-full" aria-hidden="true">
                    <path
                      d={buildLinePath(
                        summary.analytics.taskProgressTrend.map((item) => item.avgProgress),
                        360,
                        80
                      )}
                      fill="none"
                      stroke="var(--accent-strong)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </Surface>

        {summary.scope === "employee" ? (
          <AttendanceCard initialCheckedIn={(summary as EmployeeDashboardSummary).metrics.checkedIn} />
        ) : null}

        <Surface className="p-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveDashboardTab("analytics")}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold transition"
              style={{
                background: activeDashboardTab === "analytics" ? "var(--accent)" : "var(--surface-soft)",
                color: activeDashboardTab === "analytics" ? "white" : "var(--text-main)",
              }}
            >
              Analytics
            </button>
            <button
              type="button"
              onClick={() => setActiveDashboardTab("workspace")}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold transition"
              style={{
                background: activeDashboardTab === "workspace" ? "var(--accent)" : "var(--surface-soft)",
                color: activeDashboardTab === "workspace" ? "white" : "var(--text-main)",
              }}
            >
              Google Workspace
            </button>
          </div>
        </Surface>

        {activeDashboardTab === "analytics" ? (
          <>
            <section className="space-y-5" id="overview-section">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Analytics snapshot</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">Core metrics</h2>
              </div>
              <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
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
              {leadershipView ? (
                <section className="space-y-4" id="team-directory">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                      Team directory
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">Member performance</h2>
                    <p className="mt-2 max-w-2xl text-sm text-[var(--text-soft)]">
                      Use the header search or the filters below to find people. Select a card to load attendance,
                      progress, and tasks for that person.
                    </p>
                  </div>
                  <MemberPickerToolbar
                    searchQuery={globalSearch}
                    onSearchChange={setGlobalSearch}
                    roleFilter={teamDirectoryRoleFilter}
                    onRoleFilterChange={setTeamDirectoryRoleFilter}
                    roleOptions={teamDirectoryRoleOptions}
                  />
                  {teamLoading ? (
                    <StatePanel
                      title="Loading team directory"
                      description="Fetching people and baseline analytics."
                    />
                  ) : filteredTeamMembers.length === 0 ? (
                    <StatePanel
                      title="No matching team members"
                      description="Try a different search or clear the role filter."
                    />
                  ) : (
                    <TeamAnalyticsPanel
                      members={filteredTeamMembers}
                      selectedMemberId={selectedMemberId}
                      selectedAnalytics={selectedAnalytics}
                      analyticsLoading={analyticsLoading}
                      directoryTitle="Roster"
                      directorySubtitle="Live roster and analytics"
                      onSelect={setSelectedMemberId}
                    />
                  )}
                </section>
              ) : null}
              <div className="grid gap-4 xl:grid-cols-2">
                <LineChartCard
                  title={leadershipView ? "Organization work-hour trend" : "Personal work-hour trend"}
                  subtitle="Daily work-hour movement for workload tracking."
                  values={summary.analytics.workingHoursTrend.map((item) => item.hours)}
                  labels={summary.analytics.workingHoursTrend.map((item) => item.label)}
                  suffix="h"
                  stroke="var(--accent)"
                  fill="color-mix(in srgb, var(--accent) 14%, transparent)"
                />
                <LineChartCard
                  title="Task progress trend"
                  subtitle="Completion momentum across recent days."
                  values={summary.analytics.taskProgressTrend.map((item) => item.avgProgress)}
                  labels={summary.analytics.taskProgressTrend.map((item) => item.label)}
                  suffix="%"
                  stroke="var(--success)"
                  fill="color-mix(in srgb, var(--success) 12%, transparent)"
                />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <ActivityBarsCard
                  title="Created vs completed activity"
                  subtitle="Daily workload creation compared with daily completion."
                  labels={recentTrend.map((item) => item.label)}
                  createdValues={recentTrend.map((item) => item.created)}
                  completedValues={recentTrend.map((item) => item.completed)}
                />
                <PerformanceBars
                  title="Operational quality indicators"
                  subtitle="Modern CRM quality stack for delivery confidence."
                  items={[
                    {
                      label: "Task completion quality",
                      value: completionRate,
                      helper: "Share of tasks reaching done state",
                    },
                    {
                      label: "Live team availability",
                      value: attendanceRate,
                      helper: "Currently checked-in users",
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

            <section className="space-y-5" id="analytics-section">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Decision support</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">Analytics details</h2>
              </div>
              {summary.scope !== "employee" ? (
                <>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <HeatmapGrid
                      title="Team attendance heatmap"
                      subtitle="Daily participation trend across your organization."
                      items={summary.analytics.attendanceHeatmap}
                    />
                    <DonutChartCard
                      title="Attendance split (employees + interns)"
                      subtitle="Real-time check-in status across the active workforce."
                      items={[
                        { label: "Checked in", value: activeAttendance, color: "var(--success)" },
                        { label: "Not checked in", value: inactiveAttendance, color: "var(--text-faint)" },
                      ]}
                    />
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <DonutChartCard
                      title="Total work progress"
                      subtitle="Completed vs remaining tasks across all departments."
                      items={[
                        { label: "Completed", value: completedTasks, color: "var(--success)" },
                        { label: "In progress", value: inProgressEstimate, color: "var(--accent)" },
                        { label: "Pending", value: pendingEstimate, color: "var(--text-faint)" },
                      ]}
                    />
                    <DonutChartCard
                      title="Department progress contribution"
                      subtitle="Share of completed work by department."
                      items={
                        departmentPieItems.length
                          ? departmentPieItems
                          : [{ label: "No completed tasks yet", value: 1, color: "var(--text-faint)" }]
                      }
                    />
                  </div>
                  <div className="grid gap-4 xl:grid-cols-3">
                    <TeamProductivityScoreCard
                      score={teamProductivityScore}
                      completionRate={completionRate}
                      attendanceRate={attendanceRate}
                      momentum={progressDelta}
                    />
                    <WeeklyForecastCard
                      forecastPercent={forecastCompletionRate}
                      forecastCompleted={forecastCompleted}
                      baseCompleted={completedTasks}
                    />
                    <RiskAlertsCard alerts={riskAlerts} />
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <PerformerListCard
                      title="Top performers"
                      subtitle="Highest consistency across progress and attendance."
                      items={topPerformers}
                    />
                    <PerformerListCard
                      title="Needs support"
                      subtitle="Lowest current consistency scores."
                      items={needsSupport}
                    />
                  </div>
                </>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  <HeatmapGrid
                    title="Attendance heatmap"
                    subtitle="Your attendance intensity over recent days."
                    items={summary.analytics.attendanceHeatmap}
                  />
                  <DonutChartCard
                    title="Task status breakdown"
                    subtitle="Visual split of your current workload."
                    items={[
                      { label: "Pending", value: pendingEstimate, color: "var(--text-faint)" },
                      { label: "In progress", value: inProgressEstimate, color: "var(--accent)" },
                      { label: "Done", value: summary.metrics.completedTasks, color: "var(--success)" },
                    ]}
                  />
                </div>
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
                onConnect={handleGoogleConnect}
                onDisconnect={handleGoogleDisconnect}
                onCreateMeet={(attendeeUserIds) => void runWorkspaceAction("meet", attendeeUserIds)}
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
