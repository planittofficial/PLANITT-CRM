"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { CRMShell } from "@/components/layout/crm-shell";
import { renderSessionGate } from "@/components/shared/session-gate";
import { EmployeesSkeleton } from "@/components/shared/skeleton";
import { SearchIcon, CheckSquareIcon } from "@/components/ui/icons";
import { useSession } from "@/hooks/use-session";
import { apiGet } from "@/lib/api";
import { ChecklistAdminCard } from "@/components/checklist/checklist-admin-card";
import type { ChecklistAdminSummary } from "@/types/crm";

const filterOptions = [
  { value: "", label: "All Statuses" },
  { value: "completed", label: "Fully Completed" },
  { value: "in_progress", label: "In Progress" },
  { value: "not_started", label: "Not Started" },
];

export default function ChecklistPage() {
  const {
    user,
    loading: sessionLoading,
    error: sessionError,
    retry: retrySession,
  } = useSession({ allowedRoles: ["SUPERADMIN", "ADMIN"] });
  const router = useRouter();

  const [admins, setAdmins] = useState<ChecklistAdminSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (!user) return;

    // ADMIN sees only their own → redirect to their detail page
    if (user.role === "ADMIN") {
      router.replace(`/checklist/${user.id}`);
      return;
    }

    async function loadAdmins() {
      try {
        setError("");
        setLoading(true);
        const data = await apiGet<ChecklistAdminSummary[]>("/checklist");
        setAdmins(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load checklist");
      } finally {
        setLoading(false);
      }
    }
    void loadAdmins();
  }, [user, router]);

  const filteredAdmins = useMemo(() => {
    let result = admins;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.department?.name ?? "").toLowerCase().includes(q) ||
          (a.designation ?? "").toLowerCase().includes(q)
      );
    }

    if (statusFilter === "completed") {
      result = result.filter((a) => a.completionPercent >= 100);
    } else if (statusFilter === "in_progress") {
      result = result.filter((a) => a.completionPercent > 0 && a.completionPercent < 100);
    } else if (statusFilter === "not_started") {
      result = result.filter((a) => a.completionPercent === 0);
    }

    return result;
  }, [admins, search, statusFilter]);

  const stats = useMemo(() => {
    const total = admins.length;
    const completed = admins.filter((a) => a.completionPercent >= 100).length;
    const inProgress = admins.filter((a) => a.completionPercent > 0 && a.completionPercent < 100).length;
    const notStarted = admins.filter((a) => a.completionPercent === 0).length;
    return { total, completed, inProgress, notStarted };
  }, [admins]);

  const sessionGate = renderSessionGate({
    loading: sessionLoading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading checklist workspace",
    loadingDescription: "Preparing document checklists.",
  });

  if (sessionGate) return sessionGate;
  if (!user) return null;

  if (user.role === "ADMIN") {
    return (
      <CRMShell user={user}>
        <EmployeesSkeleton />
      </CRMShell>
    );
  }

  if (loading) {
    return (
      <CRMShell user={user}>
        <EmployeesSkeleton />
      </CRMShell>
    );
  }

  return (
    <CRMShell user={user}>
      <div className="min-w-0 space-y-3 sm:space-y-4 overflow-x-hidden pb-4">
        {/* Unified Mobile Checklist Workspace Card (sm:hidden) */}
        <div className="sm:hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2.5 space-y-2 shadow-xs">
          {/* Row 1: Search + Status dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={14} />
              <input
                type="search"
                value={search}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                placeholder="Search admins..."
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] pl-8.5 pr-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
              className="h-9 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)] font-medium"
            >
              <option value="">All</option>
              <option value="completed">Done</option>
              <option value="in_progress">In Progress</option>
              <option value="not_started">Not Started</option>
            </select>
          </div>

          {/* Row 2: Status chips */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex h-8 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-0.5 text-xs">
              <span className="flex h-7 items-center rounded-md bg-[var(--surface)] px-2 font-semibold text-[var(--accent)] shadow-xs">
                {stats.total} Admins
              </span>
              <span className="flex h-7 items-center px-1.5 text-emerald-600 font-semibold dark:text-emerald-400">
                {stats.completed} Done
              </span>
            </div>
            <div className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 text-[11px] font-medium text-[var(--text-main)]">
              <span className="text-[var(--text-soft)]">In Progress:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{stats.inProgress}</span>
            </div>
          </div>
        </div>

        {/* Desktop Header */}
        <section className="hidden sm:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-[var(--accent)] border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                Onboarding
              </span>
              <span className="text-xs text-[var(--text-soft)]">Administrative Readiness</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">
              Document Checklist
            </h1>
            <p className="mt-0.5 text-xs text-[var(--text-soft)]">
              Track onboarding documents, credentials, assets, and training completion for administrators.
            </p>
          </div>
        </section>

        {/* Desktop Summary stats */}
        <section className="hidden sm:grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Total Admins",
              value: stats.total,
              color: "var(--accent)",
            },
            {
              label: "Fully Completed",
              value: stats.completed,
              color: "var(--success)",
            },
            {
              label: "In Progress",
              value: stats.inProgress,
              color: "var(--warning)",
            },
            {
              label: "Not Started",
              value: stats.notStarted,
              color: "var(--text-faint)",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xs"
            >
              <p className="text-xs font-medium text-[var(--text-soft)]">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-bold" style={{ color: stat.color }}>
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* Main Directory & Grid */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5 shadow-xs">
          <div className="mb-4 hidden sm:flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border)] pb-3">
            <div>
              <p className="text-sm font-bold text-[var(--text-main)]">Admin Directory</p>
              <p className="text-xs text-[var(--text-soft)]">
                {filteredAdmins.length} admin{filteredAdmins.length !== 1 ? "s" : ""} found
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-64">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={14} />
                <input
                  type="search"
                  value={search}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] pl-8.5 pr-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                  placeholder="Search name, department..."
                  aria-label="Search admins"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)] font-medium"
                aria-label="Filter by status"
              >
                {filterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
              {error}
            </p>
          ) : filteredAdmins.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-xs text-[var(--text-soft)]">
              {admins.length === 0
                ? "No Admin users found. Create admin accounts to start tracking."
                : "No admins match your search."}
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredAdmins.map((admin) => (
                <ChecklistAdminCard key={admin.id} admin={admin} />
              ))}
            </div>
          )}
        </section>
      </div>
    </CRMShell>
  );
}
