"use client";

import type { ReactNode } from "react";

export function LoadingSkeleton({
  title = "Loading",
  subtitle = "Fetching the latest data...",
  blocks = 6,
}: {
  title?: string;
  subtitle?: string;
  blocks?: number;
}) {
  return (
    <section
      className="rounded-[20px] border p-5"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-soft)",
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="animate-pulse">
        <div className="h-4 w-32 rounded-md" style={{ background: "var(--surface-soft)" }} />
        <div className="mt-3 h-8 w-56 rounded-md" style={{ background: "var(--surface-soft)" }} />
        <div className="mt-2 h-4 w-72 max-w-full rounded-md" style={{ background: "var(--surface-soft)" }} />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: Math.max(1, blocks) }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-2xl border"
              style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
            />
          ))}
        </div>
      </div>
      <p className="mt-5 text-xs tracking-[0.16em] text-[var(--text-faint)] uppercase">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-soft)]">{subtitle}</p>
    </section>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse" aria-live="polite" aria-busy="true">
      {Array.from({ length: Math.max(1, rows) }).map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-2xl border"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
        />
      ))}
    </div>
  );
}

