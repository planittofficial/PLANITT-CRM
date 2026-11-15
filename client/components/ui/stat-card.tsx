import type { ReactNode } from "react";
import { ArrowUpRightIcon, ArrowDownRightIcon } from "./icons";

interface StatCardProps {
  label: string;
  value: string | number;
  helper?: string;
  trend?: {
    value: string | number;
    isPositive?: boolean;
    label?: string;
  };
  icon?: ReactNode;
  points?: number[];
  className?: string;
}

function MiniSparkline({ points, stroke = "#2563eb" }: { points: number[]; stroke?: string }) {
  if (!points || points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const width = 80;
  const height = 28;

  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" className="shrink-0 overflow-visible">
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  helper,
  trend,
  icon,
  points,
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3 sm:p-4 shadow-xs transition-all hover:shadow-sm ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-[11px] font-semibold text-[var(--text-soft)] truncate">{label}</p>
        {icon && <div className="text-[var(--text-soft)] shrink-0">{icon}</div>}
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-1.5">
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-main)] truncate">{value}</h3>
        {points && points.length > 1 && <MiniSparkline points={points} />}
      </div>

      {(helper || trend) && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 font-semibold ${
                trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {trend.isPositive ? <ArrowUpRightIcon size={14} /> : <ArrowDownRightIcon size={14} />}
              {trend.value}
            </span>
          )}
          {helper && <span className="text-[var(--text-soft)] truncate">{helper}</span>}
        </div>
      )}
    </div>
  );
}
