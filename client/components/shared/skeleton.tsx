export function Skeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`
        animate-pulse
        rounded-3xl
        bg-[var(--surface-soft)]
        ${className}
      `}
    />
  );
}

export function TasksSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-10 w-56" />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-[500px] w-full" />
        </div>

        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProjectsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-10 w-64" />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Skeleton className="h-[650px]" />

        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function EmployeesSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-10 w-64" />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChatsSkeleton() {
  return (
    <div className="grid h-[80vh] gap-6 p-6 xl:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>

      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />

        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-12 ${i % 2 ? "ml-auto w-2/3" : "w-2/3"}`}
          />
        ))}
      </div>
    </div>
  );
}