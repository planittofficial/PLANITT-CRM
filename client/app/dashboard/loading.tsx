import { DashboardSkeleton } from "@/components/shared/skeleton";

export default function Loading() {
  return (
    <div className="p-4 sm:p-6 mx-auto max-w-7xl w-full">
      <DashboardSkeleton />
    </div>
  );
}
