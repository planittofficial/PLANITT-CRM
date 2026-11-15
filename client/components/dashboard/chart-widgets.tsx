"use client";

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import type { CRMUser } from "@/types/crm";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export function Surface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs transition-shadow duration-150 hover:shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function formatRole(role: CRMUser["role"]) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export function rosterRolePillStyle(role: CRMUser["role"]): CSSProperties {
  switch (role) {
    case "SUPERADMIN":
    case "ADMIN":
      return {
        background: "color-mix(in srgb, var(--accent) 15%, var(--surface))",
        color: "var(--accent-strong)",
        borderColor: "color-mix(in srgb, var(--accent) 30%, var(--border))",
      };
    case "MANAGER":
      return {
        background: "color-mix(in srgb, var(--success) 14%, var(--surface))",
        color: "var(--success)",
        borderColor: "color-mix(in srgb, var(--success) 30%, var(--border))",
      };
    case "EMPLOYEE":
      return {
        background: "var(--surface-soft)",
        color: "var(--text-main)",
        borderColor: "var(--border)",
      };
    default:
      return {
        background: "var(--surface-soft)",
        color: "var(--text-soft)",
        borderColor: "var(--border)",
      };
  }
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function buildLinePath(points: number[], width: number, height: number) {
  if (!points.length) return "";
  const max = Math.max(...points, 1);
  return points
    .map((p, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * width;
      const y = height - (p / max) * height;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

// Custom tooltip for real recharts
function CustomChartTooltip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; color?: string }>;
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-md">
      {label && <p className="text-xs font-semibold text-[var(--text-main)] mb-1">{label}</p>}
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-xs">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color ?? "var(--accent)" }}
          />
          <span className="text-[var(--text-soft)]">{entry.name ?? "Value"}:</span>
          <span className="font-semibold text-[var(--text-main)]">
            {entry.value}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SummaryStatCard({
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
  const [mounted, setMounted] = useState(false);
  const chartId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = points.map((val, idx) => ({ idx, val }));

  return (
    <Surface className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--text-soft)]">{label}</p>
          <h3 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl lg:text-3xl">
            {value}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-faint)] truncate">{helper}</p>
        </div>

        {points && points.length > 1 && (
          <div className="h-10 w-24 shrink-0 sm:w-28">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
                  <defs>
                    <linearGradient id={`grad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="val"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    fill={`url(#grad-${chartId})`}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded bg-[var(--surface-soft)]" />
            )}
          </div>
        )}
      </div>
    </Surface>
  );
}

export function LineChartCard({
  title,
  subtitle,
  values,
  labels,
  suffix = "",
  stroke = "var(--accent)",
  fill = "color-mix(in srgb, var(--accent) 15%, transparent)",
}: {
  title: string;
  subtitle: string;
  values: number[];
  labels: string[];
  suffix?: string;
  stroke?: string;
  fill?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const chartId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = labels.map((label, idx) => ({
    label,
    value: values[idx] ?? 0,
  }));

  return (
    <Surface className="p-4 sm:p-5">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-[var(--text-main)]">{title}</h4>
        <p className="mt-0.5 text-xs text-[var(--text-soft)]">{subtitle}</p>
      </div>

      <div className="h-52 w-full pt-2">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`areaGrad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={stroke} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={stroke} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
                opacity={0.7}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--text-soft)", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                minTickGap={16}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "var(--text-soft)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                unit={suffix}
              />
              <Tooltip content={<CustomChartTooltip suffix={suffix} />} />
              <Area
                type="monotone"
                dataKey="value"
                name={title}
                stroke={stroke}
                strokeWidth={2.5}
                fill={`url(#areaGrad-${chartId})`}
                activeDot={{ r: 5, stroke: stroke, fill: "var(--surface)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full animate-pulse rounded-lg bg-[var(--surface-soft)]" />
        )}
      </div>
    </Surface>
  );
}

export function ActivityBarsCard({
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = labels.slice(-7).map((label, idx) => {
    const origIndex = labels.length - 7 + idx;
    return {
      label: label.split(" ")[1] ?? label,
      created: createdValues[origIndex] ?? 0,
      completed: completedValues[origIndex] ?? 0,
    };
  });

  return (
    <Surface className="p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-main)]">{title}</h4>
          <p className="mt-0.5 text-xs text-[var(--text-soft)]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-soft)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[var(--accent)]" />
            Created
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
            Completed
          </span>
        </div>
      </div>

      <div className="h-56 w-full pt-2">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={4} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
                opacity={0.7}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--text-soft)", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                minTickGap={16}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "var(--text-soft)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomChartTooltip />} />
              <Bar dataKey="created" name="Created" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Completed" fill="#107c41" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full animate-pulse rounded-lg bg-[var(--surface-soft)]" />
        )}
      </div>
    </Surface>
  );
}

export function InsightTicker({
  items,
}: {
  items: Array<{ label: string; value: string; tone: "neutral" | "positive" | "warning" }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => {
        const isPos = item.tone === "positive";
        const isWarn = item.tone === "warning";
        return (
          <div
            key={item.label}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[var(--text-soft)]">{item.label}</p>
              <span
                className={`h-2 w-2 rounded-full ${
                  isPos ? "bg-emerald-500" : isWarn ? "bg-amber-500" : "bg-slate-400"
                }`}
              />
            </div>
            <p className="mt-1.5 text-sm font-semibold text-[var(--text-main)] truncate">
              {item.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function PerformanceBars({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; value: number; helper: string }>;
}) {
  return (
    <Surface className="p-4 sm:p-5">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-[var(--text-main)]">{title}</h4>
        <p className="mt-0.5 text-xs text-[var(--text-soft)]">{subtitle}</p>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--text-main)]">{item.label}</span>
              <span className="font-semibold text-[var(--text-main)]">{item.value}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-soft)] border border-[var(--border)]">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.max(0, item.value))}%`,
                  backgroundColor:
                    item.value >= 70
                      ? "var(--success)"
                      : item.value >= 40
                      ? "var(--accent)"
                      : "var(--warning)",
                }}
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-faint)]">{item.helper}</p>
          </div>
        ))}
      </div>
    </Surface>
  );
}

export function HeatmapGrid({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ date: string; label: string; value: number; intensity: number }>;
}) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <Surface className="p-4 sm:p-5">
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-[var(--text-main)]">{title}</h4>
        <p className="mt-0.5 text-xs text-[var(--text-soft)]">{subtitle}</p>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-7 md:grid-cols-10">
        {items.map((item) => {
          const isToday = item.date === todayKey;
          const bg =
            item.intensity <= 0
              ? "bg-[var(--surface-soft)]"
              : item.intensity < 30
              ? "bg-indigo-100 dark:bg-indigo-950/60"
              : item.intensity < 70
              ? "bg-indigo-300 dark:bg-indigo-800/80"
              : "bg-[var(--accent)] text-white";

          return (
            <div
              key={item.date}
              title={`${item.label} (${item.date}): ${item.value} entries`}
              className={`group relative flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-transform hover:scale-105 ${bg} ${
                isToday ? "ring-2 ring-[var(--accent)] ring-offset-1" : "border-[var(--border)]"
              }`}
            >
              <span className="text-[10px] font-medium opacity-80">
                {item.label.split(" ")[0]}
              </span>
              <span className="text-xs font-bold">{item.value}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-[var(--text-soft)]">
        <span>Less</span>
        <span className="h-2.5 w-2.5 rounded bg-[var(--surface-soft)] border border-[var(--border)]" />
        <span className="h-2.5 w-2.5 rounded bg-indigo-100 dark:bg-indigo-950/60" />
        <span className="h-2.5 w-2.5 rounded bg-indigo-300 dark:bg-indigo-800/80" />
        <span className="h-2.5 w-2.5 rounded bg-[var(--accent)]" />
        <span>More</span>
      </div>
    </Surface>
  );
}
