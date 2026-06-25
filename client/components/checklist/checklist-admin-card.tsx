"use client";

import Link from "next/link";
import type { ChecklistAdminSummary } from "@/types/crm";
import { ChecklistProgressRing } from "@/components/checklist/checklist-progress-ring";

type AdminCardProps = {
  admin: ChecklistAdminSummary;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function statusBadge(percent: number) {
  if (percent >= 100) {
    return { label: "Fully Completed", bg: "color-mix(in srgb, var(--success) 16%, transparent)", color: "var(--success)" };
  }
  if (percent > 0) {
    return { label: "In Progress", bg: "color-mix(in srgb, var(--warning) 16%, transparent)", color: "var(--warning)" };
  }
  return { label: "Not Started", bg: "color-mix(in srgb, var(--text-faint) 16%, transparent)", color: "var(--text-faint)" };
}

export function ChecklistAdminCard({ admin }: AdminCardProps) {
  const badge = statusBadge(admin.completionPercent);

  return (
    <Link
      href={`/checklist/${admin.id}`}
      className="group block rounded-2xl border p-5 transition-all duration-200 hover:shadow-lg"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="shrink-0">
          {admin.avatarUrl && admin.authProvider === "google" ? (
            <img
              src={admin.avatarUrl}
              alt={admin.name}
              className="h-12 w-12 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="crm-avatar flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
            >
              {initials(admin.name)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text-main)] group-hover:text-[var(--accent-strong)]">
            {admin.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--text-soft)]">
            {admin.designation ?? admin.role}
          </p>
          {admin.department ? (
            <span
              className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                color: "var(--accent-strong)",
              }}
            >
              {admin.department.name}
            </span>
          ) : null}
          {admin.createdAt ? (
            <p className="mt-2 text-[10px] text-[var(--text-faint)]">
              Joined {new Date(admin.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          ) : null}
        </div>

        {/* Progress */}
        <div className="shrink-0">
          <ChecklistProgressRing percent={admin.completionPercent} size={56} strokeWidth={5} />
        </div>
      </div>

      {/* Progress bar + status */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[10px] font-semibold">
          <span style={{ color: badge.color }}>{badge.label}</span>
          <span className="text-[var(--text-faint)]">
            {admin.completedItems}/{admin.totalItems}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${admin.completionPercent}%`,
              background: admin.completionPercent >= 100
                ? "var(--success)"
                : "linear-gradient(90deg, var(--accent), var(--accent-alt))",
            }}
          />
        </div>
      </div>
    </Link>
  );
}
