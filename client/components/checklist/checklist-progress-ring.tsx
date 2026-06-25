"use client";

type ProgressRingProps = {
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
};

export function ChecklistProgressRing({
  percent,
  size = 72,
  strokeWidth = 6,
  label,
  className = "",
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clampedPercent / 100) * circumference;

  const getColor = () => {
    if (clampedPercent >= 100) return "var(--success)";
    if (clampedPercent >= 50) return "var(--accent)";
    if (clampedPercent > 0) return "var(--warning)";
    return "var(--text-faint)";
  };

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span
          className="text-sm font-bold"
          style={{ color: getColor() }}
        >
          {clampedPercent}%
        </span>
      </div>
      {label ? (
        <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
          {label}
        </span>
      ) : null}
    </div>
  );
}
