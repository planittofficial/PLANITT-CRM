"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { CRMShell } from "@/components/layout/crm-shell";
import { renderSessionGate } from "@/components/shared/session-gate";
import { EmployeesSkeleton } from "@/components/shared/skeleton";
import { useSession } from "@/hooks/use-session";
import { apiGet } from "@/lib/api";
import { ChecklistAdminCard } from "@/components/checklist/checklist-admin-card";
import type { ChecklistAdminSummary } from "@/types/crm";

const filterOptions = [
  { value: "", label: "All" },
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
      <div className="min-w-0 space-y-4 overflow-x-hidden pb-4">
        {/* Header */}
        <section
          className="rounded-[20px] border p-5"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
              Admin onboarding
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]">
              Document Checklist
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
              Track onboarding documents, credentials, company assets, and training completion for
              every Admin.
            </p>
          </div>
        </section>

        {/* Summary stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: "Total Admins",
              value: admins.length,
              color: "var(--accent)",
            },
            {
              label: "Fully Completed",
              value: admins.filter((a) => a.completionPercent >= 100).length,
              color: "var(--success)",
            },
            {
              label: "In Progress",
              value: admins.filter((a) => a.completionPercent > 0 && a.completionPercent < 100).length,
              color: "var(--warning)",
            },
            {
              label: "Not Started",
              value: admins.filter((a) => a.completionPercent === 0).length,
              color: "var(--text-faint)",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border p-4"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                {stat.label}
              </p>
              <p className="mt-2 text-2xl font-bold" style={{ color: stat.color }}>
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* Filters + Grid */}
        <section
          className="rounded-[20px] border p-5"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-main)]">Admin Directory</p>
              <p className="mt-1 text-xs text-[var(--text-soft)]">
                {filteredAdmins.length} admin{filteredAdmins.length !== 1 ? "s" : ""} found
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="search"
                value={search}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                className="crm-input h-10 w-full min-w-0 rounded-xl px-3 text-sm sm:w-56"
                placeholder="Search by name, department..."
                aria-label="Search admins"
              />
              <select
                value={statusFilter}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
                className="crm-input h-10 rounded-xl px-3 text-sm"
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
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          ) : filteredAdmins.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-[var(--text-soft)]">
                {admins.length === 0
                  ? "No Admin users found. Create admin accounts to start tracking."
                  : "No admins match your search."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
