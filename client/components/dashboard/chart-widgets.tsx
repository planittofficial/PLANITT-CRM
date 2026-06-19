"use client";

import type { CSSProperties } from "react";
import type { CRMUser } from "@/types/crm";

export function Surface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[24px] border ${className}`}
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}
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
    default:
      return { background: "var(--surface-soft)", color: "var(--text-soft)", borderColor: "var(--border)" };
  }
}

export function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
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

export function SummaryStatCard({ label, value, helper, points }: { label: string; value: string | number; helper: string; points: number[] }) {
  const path = buildLinePath(points, 140, 44);
  return (
    <Surface className="overflow-hidden p-3 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-faint)]">{label}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-main)] sm:text-2xl lg:text-3xl">{value}</h3>
          <p className="mt-1 text-sm text-[var(--text-soft)] sm:mt-2">{helper}</p>
        </div>
        <div className="hidden shrink-0 rounded-2xl border px-3 py-2 sm:block" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
          <svg width="140" height="44" viewBox="0 0 140 44" fill="none" aria-hidden="true">
            <path d={path} stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </Surface>
  );
}

export function LineChartCard({ title, subtitle, values, labels, suffix = "", stroke = "var(--accent)", fill = "color-mix(in srgb, var(--accent) 14%, transparent)" }: {
  title: string; subtitle: string; values: number[]; labels: string[]; suffix?: string; stroke?: string; fill?: string;
}) {
  const width = 320; const height = 180;
  const max = Math.max(...values, 1);
  const path = buildLinePath(values, width, height - 24);
  const areaPath = values.length ? `${path} L ${width} ${height} L 0 ${height} Z` : "";
  return (
    <Surface className="p-4 sm:p-5">
      <div className="mb-5">
        <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
        <p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p>
      </div>
      <div className="overflow-hidden rounded-[20px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-32 sm:h-40 md:h-48 w-full" aria-hidden="true">
          {[0,1,2,3].map((s) => { const y = 12+(s/3)*(height-36); return <line key={s} x1="0" y1={y} x2={width} y2={y} stroke="color-mix(in srgb, var(--border) 80%, transparent)" strokeDasharray="4 6" />; })}
          {areaPath ? <path d={areaPath} fill={fill} /> : null}
          {path ? <path d={path} fill="none" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {values.map((v, i) => { const x=(i/Math.max(values.length-1,1))*width; const y=height-24-(v/max)*(height-24); return <circle key={`${labels[i]}-${v}`} cx={x} cy={y} r="4" fill={stroke} />; })}
        </svg>
<div className="mt-4 flex justify-between gap-1 overflow-x-auto pb-1">  {labels.filter((_, i) => i % 2 === 0).map((l, i) => (
    <div
      key={`${l}-${i}`}
className="min-w-[28px] flex-shrink-0 text-center"    >
      <p className="text-[10px] text-[var(--text-faint)]">
        {l.split(" ")[1] ?? l}
      </p>
      <p className="mt-1 text-xs font-semibold text-[var(--text-main)]">
        {values[i]}{suffix}
      </p>
    </div>
  ))}
</div>
      </div>
    </Surface>
  );
}

export function ActivityBarsCard({ title, subtitle, labels, createdValues, completedValues }: {
  title: string; subtitle: string; labels: string[]; createdValues: number[]; completedValues: number[];
}) {
  const maxValue = Math.max(1, ...createdValues, ...completedValues);
  return (
    <Surface className="p-4">
      <div className="mb-5"><p className="text-sm font-semibold text-[var(--text-main)]">{title}</p><p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p></div>
      <div className="rounded-[20px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
        <div className="space-y-3.5">
{labels.slice(-5).map((label, idx) => {
  const i = labels.length - 5 + idx;
  const c = createdValues[i] ?? 0;
  const d = completedValues[i] ?? 0;
            return (
              <div key={`${label}-${i}`}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-[var(--text-main)]">{label}</p>
                  <p className="text-xs text-[var(--text-soft)]">C:{c} / D:{d}</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--border) 60%, transparent)" }}>
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(c/maxValue)*100}%` }} />
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--border) 60%, transparent)" }}>
                  <div className="h-full rounded-full bg-[var(--success)]" style={{ width: `${(d/maxValue)*100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-[var(--text-soft)]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />Created</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--success)]" />Completed</span>
        </div>
      </div>
    </Surface>
  );
}

export function InsightTicker({ items }: { items: Array<{ label: string; value: string; tone: "neutral" | "positive" | "warning" }> }) {
  return (
    <Surface className="p-4">
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: item.tone === "positive" ? "color-mix(in srgb, var(--success) 12%, var(--surface))" : item.tone === "warning" ? "color-mix(in srgb, var(--warning) 12%, var(--surface))" : "var(--surface-soft)" }}>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">{item.label}</p>
            <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">{item.value}</p>
          </div>
        ))}
      </div>
    </Surface>
  );
}

export function PerformanceBars({ title, subtitle, items }: { title: string; subtitle: string; items: Array<{ label: string; value: number; helper: string }> }) {
  return (
    <Surface className="p-4 sm:p-5">
      <div className="mb-5"><p className="text-sm font-semibold text-[var(--text-main)]">{title}</p><p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p></div>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-medium text-[var(--text-main)]">{item.label}</p><p className="text-xs text-[var(--text-soft)]">{item.helper}</p></div>
              <span className="text-sm font-semibold text-[var(--text-main)]">{item.value}%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface-soft)" }}>
              <div className="h-full rounded-full" style={{ width: `${item.value}%`, background: "linear-gradient(90deg, var(--accent-strong) 0%, var(--accent) 55%, var(--success) 100%)" }} />
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

export function HeatmapGrid({ title, subtitle, items }: { title: string; subtitle: string; items: Array<{ date: string; label: string; value: number; intensity: number }> }) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  function getHeatmapStyles(intensity: number, isToday: boolean) {
    if (intensity <= 0) {
      return {
        background: "var(--surface-soft)",
        borderColor: isToday ? "var(--accent)" : "var(--border)",
        boxShadow: isToday ? "0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent) inset" : "none",
      };
    }

    if (intensity < 30) {
      return {
        background: "color-mix(in srgb, var(--accent) 20%, var(--surface-soft))",
        borderColor: isToday ? "var(--accent-strong)" : "color-mix(in srgb, var(--accent) 35%, var(--border))",
        boxShadow: isToday ? "0 0 0 1px color-mix(in srgb, var(--accent-strong) 40%, transparent) inset" : "none",
      };
    }

    if (intensity < 65) {
      return {
        background: "color-mix(in srgb, var(--accent) 42%, var(--surface-soft))",
        borderColor: isToday ? "var(--accent-strong)" : "color-mix(in srgb, var(--accent) 50%, var(--border))",
        boxShadow: isToday ? "0 0 0 1px color-mix(in srgb, var(--accent-strong) 45%, transparent) inset" : "none",
      };
    }

    return {
      background: "linear-gradient(180deg, color-mix(in srgb, var(--accent-strong) 82%, var(--surface-soft)), color-mix(in srgb, var(--accent) 66%, var(--surface-soft)))",
      borderColor: isToday ? "var(--accent-strong)" : "color-mix(in srgb, var(--accent-strong) 55%, var(--border))",
      boxShadow: isToday ? "0 0 0 1px color-mix(in srgb, var(--accent-strong) 55%, transparent) inset" : "none",
    };
  }

  return (
    <Surface className="p-4 sm:p-5">
      <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p>
<div className="mt-5 grid grid-cols-4 sm:grid-cols-5 gap-2">        {items.map((item) => (
          <div key={item.date} className="space-y-1 text-center">
            <div
className="h-7 sm:h-9 rounded-xl border transition-all"              title={`${item.label}: ${item.value}`}
              style={getHeatmapStyles(item.intensity, item.date === todayKey)}
            />
            <p className="text-[10px] text-[var(--text-faint)]">{item.label.split(" ")[1] ?? item.label}</p>
          </div>
        ))}
      </div>
    </Surface>
  );
}
