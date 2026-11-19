export function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`
        crm-skeleton-shimmer
        rounded-xl
        bg-[var(--surface-soft)]
        ${className}
      `}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-150" aria-busy="true" aria-label="Loading dashboard">
      {/* Welcome Banner Skeleton */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-4 w-28 rounded-md" />
            </div>
            <Skeleton className="h-7 w-48 sm:w-64 rounded-lg" />
            <Skeleton className="h-4 w-60 sm:w-80 rounded-md" />
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3">
            <Skeleton className="h-16 w-full sm:w-24 rounded-xl" />
            <Skeleton className="h-16 w-full sm:w-24 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Attendance Card Skeleton */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <Skeleton className="h-12 w-12 rounded-2xl shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-32 rounded-md" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-48 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-10 w-full sm:w-32 rounded-xl" />
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>

      {/* 4 Summary Stat Cards Skeleton */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 space-y-2">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-3.5 w-36 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Charts Grid Skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
          <Skeleton className="h-5 w-44 rounded-md" />
          <Skeleton className="h-4 w-60 rounded-md" />
          <Skeleton className="h-52 w-full rounded-xl mt-4" />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
          <Skeleton className="h-5 w-44 rounded-md" />
          <Skeleton className="h-4 w-60 rounded-md" />
          <Skeleton className="h-52 w-full rounded-xl mt-4" />
        </div>
      </div>
    </div>
  );
}

export function CrmSkeleton() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden animate-in fade-in duration-150" aria-busy="true" aria-label="Loading CRM pipeline">
      {/* Header Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-4 sm:px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-3.5 w-64 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-6 border-b border-[var(--border)] bg-[var(--surface)]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 space-y-1.5">
            <Skeleton className="h-3.5 w-20 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
        ))}
      </div>

      {/* Kanban Board Columns Skeleton */}
      <div className="flex-1 overflow-x-auto p-4 sm:p-6 flex gap-4 min-w-[1000px]">
        {Array.from({ length: 5 }).map((_, col) => (
          <div key={col} className="w-64 shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]/50 p-3 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 w-8 rounded-full" />
            </div>
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((_, card) => (
                <div key={card} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-3.5 w-20 rounded-md" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamsSkeleton() {
  return (
    <div className="grid h-full grid-cols-1 md:grid-cols-[280px_1fr] overflow-hidden animate-in fade-in duration-150" aria-busy="true">
      <div className="border-r border-[var(--border)] bg-[var(--surface)] p-3 space-y-3">
        <Skeleton className="h-9 w-full rounded-xl" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <div className="flex flex-col bg-[var(--app-bg)] p-4 justify-between">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--border)]">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-3 w-48 rounded-md" />
          </div>
        </div>
        <div className="space-y-3 my-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`flex gap-2.5 ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <Skeleton className={`h-12 rounded-2xl ${i % 2 === 0 ? "w-48" : "w-64"}`} />
            </div>
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-xl mt-4" />
      </div>
    </div>
  );
}

export function TasksSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6 animate-in fade-in duration-150" aria-busy="true">
      <Skeleton className="h-10 w-56 rounded-xl" />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>

        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProjectsSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6 animate-in fade-in duration-150" aria-busy="true">
      <Skeleton className="h-10 w-64 rounded-xl" />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Skeleton className="h-[500px] rounded-2xl" />

        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function EmployeesSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6 animate-in fade-in duration-150" aria-busy="true">
      <Skeleton className="h-10 w-64 rounded-xl" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-5 w-40 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChatsSkeleton() {
  return (
    <div className="grid h-[80vh] gap-4 p-4 sm:p-6 xl:grid-cols-[320px_1fr] animate-in fade-in duration-150" aria-busy="true">
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>

      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />

        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-12 rounded-2xl ${i % 2 ? "ml-auto w-2/3" : "w-2/3"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4 animate-in fade-in duration-150" aria-busy="true" aria-label="Loading analytics report">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`kpi-${i}`} className="h-28 w-full sm:h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-2">
        <Skeleton className="h-56 w-full sm:h-72 rounded-2xl" />
        <Skeleton className="h-56 w-full sm:h-72 rounded-2xl" />
      </div>
      <Skeleton className="h-48 w-full sm:h-64 rounded-2xl" />
      <Skeleton className="h-44 w-full sm:h-56 rounded-2xl" />
    </div>
  );
}
