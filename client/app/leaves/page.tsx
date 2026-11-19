"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { CRMShell } from "@/components/layout/crm-shell";
import { ResponsiveSelect } from "@/components/shared/responsive-select";
import { renderSessionGate } from "@/components/shared/session-gate";
import { EmployeesSkeleton } from "@/components/shared/skeleton";
import { SearchIcon, PlusIcon, CalendarDaysIcon } from "@/components/ui/icons";
import { useSession } from "@/hooks/use-session";
import { apiGet } from "@/lib/api";
import type { LeaveRequest } from "@/types/crm";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "MORE_INFORMATION", label: "Need more info" },
  { value: "ALTERNATIVE_SUGGESTED", label: "Alternative suggested" },
  { value: "CANCELLED", label: "Cancelled" },
];

function statusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "MORE_INFORMATION":
      return "Need more info";
    case "ALTERNATIVE_SUGGESTED":
      return "Alternative suggested";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export default function LeavesPage() {
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const statusSelectOptions = useMemo(
    () => statusOptions.map((option) => ({ value: option.value, label: option.label })),
    []
  );

  useEffect(() => {
    async function loadLeaves() {
      try {
        setError("");
        setLoading(true);
        const query = new URLSearchParams();
        if (statusFilter) {
          query.set("status", statusFilter);
        }
        if (search) {
          query.set("search", search);
        }

        const leaves = await apiGet<LeaveRequest[]>(`/leaves${query.toString() ? `?${query.toString()}` : ""}`);
        setLeaveRequests(leaves);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load leave requests");
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      void loadLeaves();
    }
  }, [user, search, statusFilter]);

  const filteredLeaves = useMemo(() => {
    return leaveRequests;
  }, [leaveRequests]);

  const stats = useMemo(() => {
    const total = leaveRequests.length;
    const pending = leaveRequests.filter((l) => l.status === "PENDING").length;
    const approved = leaveRequests.filter((l) => l.status === "APPROVED").length;
    return { total, pending, approved };
  }, [leaveRequests]);

  const sessionGate = renderSessionGate({
    loading: sessionLoading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading leave workspace",
    loadingDescription: "Preparing leave requests and approvals.",
  });

  if (sessionGate) {
    return sessionGate;
  }

  if (!user) {
    return null;
  }
  if (loading) {
    return (
      <CRMShell user={user}>
        <EmployeesSkeleton />
      </CRMShell>
    );
  }

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  return (
    <CRMShell user={user}>
      <div className="min-w-0 space-y-3 sm:space-y-4 overflow-x-hidden pb-4">
        {/* Unified Mobile Leave Workspace Card (sm:hidden) */}
        <div className="sm:hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2.5 space-y-2 shadow-xs">
          {/* Row 1: Search + Apply Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={14} />
              <input
                type="search"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search leaves, employees..."
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] pl-8.5 pr-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <Link
              href="/leaves/new"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-strong)] px-3 text-xs font-semibold text-white shadow-xs transition-colors"
            >
              <PlusIcon size={14} />
              <span>Apply</span>
            </Link>
          </div>

          {/* Row 2: Status Tabs + Pending Count Chip */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex h-8 items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-0.5 text-xs overflow-x-auto no-scrollbar">
              {[
                { label: "All", value: "" },
                { label: "Pending", value: "PENDING" },
                { label: "Approved", value: "APPROVED" },
                { label: "Rejected", value: "REJECTED" },
              ].map((tab) => {
                const isActive = statusFilter === tab.value;
                return (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={() => setStatusFilter(tab.value)}
                    className={`flex h-7 items-center whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition-colors ${
                      isActive
                        ? "bg-[var(--surface)] text-[var(--accent)] shadow-xs"
                        : "text-[var(--text-soft)] hover:text-[var(--text-main)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-amber-200/70 bg-amber-50/80 px-2.5 text-[11px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
              <span>Pending:</span>
              <span className="font-bold">{stats.pending}</span>
            </div>
          </div>
        </div>

        {/* Desktop Header */}
        <section className="hidden sm:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-[var(--accent)] border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                  Human Resources
                </span>
                <span className="text-xs text-[var(--text-soft)]">Time Off Management</span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">Leaves & Absences</h1>
              <p className="mt-0.5 text-xs text-[var(--text-soft)]">
                Submit leave requests, review team approvals, and track status.
              </p>
            </div>
            <Link
              href="/leaves/new"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-strong)] px-4 text-xs font-semibold text-white shadow-xs transition-colors"
            >
              <PlusIcon size={14} className="mr-1.5" />
              Apply for Leave
            </Link>
          </div>
        </section>

        {/* Main Content Section */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5 shadow-xs">
          <div className="mb-4 hidden sm:flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border)] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">Leave Requests</h3>
              <p className="text-xs text-[var(--text-soft)]">{filteredLeaves.length} requests in record</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full sm:w-64">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={14} />
                <input
                  type="search"
                  value={search}
                  onChange={handleSearchChange}
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] pl-8.5 pr-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                  placeholder="Search type, requester, manager..."
                />
              </div>
              <ResponsiveSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusSelectOptions}
                ariaLabel="Filter leave requests by status"
                buttonClassName="h-9 rounded-lg text-xs px-3"
              />
            </div>
          </div>

          {loading ? (
            <p className="py-8 text-center text-xs text-[var(--text-soft)]">Loading leave requests...</p>
          ) : error ? (
            <p className="py-8 text-center text-xs text-rose-600">{error}</p>
          ) : filteredLeaves.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-xs text-[var(--text-soft)]">
              No leave requests match your search or filter.
            </div>
          ) : (
            <>
              {/* Mobile Card List View */}
              <div className="sm:hidden space-y-2.5">
                {filteredLeaves.map((leave) => {
                  const isPending = leave.status === "PENDING";
                  const isApproved = leave.status === "APPROVED";
                  const isRejected = leave.status === "REJECTED";

                  return (
                    <div
                      key={leave.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 space-y-2 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/leaves/${leave.id}`} className="font-bold text-xs text-[var(--accent)] hover:underline">
                          {leave.leaveType?.name ?? "General Leave"}
                        </Link>
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                            isApproved
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : isRejected
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                              : isPending
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                              : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                          }`}
                        >
                          {statusLabel(leave.status)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-soft)]">
                        <span>Requester: <strong className="text-[var(--text-main)] font-semibold">{leave.user.name}</strong></span>
                        <span>Manager: {leave.manager?.name ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-[var(--text-faint)] pt-1.5 border-t border-[var(--border)]">
                        <span>{new Date(leave.startDate).toLocaleDateString()} – {new Date(leave.endDate).toLocaleDateString()}</span>
                        <span>Updated: {new Date(leave.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-[var(--border)] crm-table-scroll">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-[var(--surface-soft)] border-b border-[var(--border)]">
                    <tr className="font-semibold text-[var(--text-soft)]">
                      <th className="px-3.5 py-2.5">Type</th>
                      <th className="px-3.5 py-2.5">Requester</th>
                      <th className="px-3.5 py-2.5">Manager</th>
                      <th className="px-3.5 py-2.5">Period</th>
                      <th className="px-3.5 py-2.5">Status</th>
                      <th className="px-3.5 py-2.5">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[var(--surface)] divide-y divide-[var(--border)] text-[var(--text-main)]">
                    {filteredLeaves.map((leave) => {
                      const isPending = leave.status === "PENDING";
                      const isApproved = leave.status === "APPROVED";
                      const isRejected = leave.status === "REJECTED";

                      return (
                        <tr key={leave.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                          <td className="px-3.5 py-2.5 align-middle">
                            <Link href={`/leaves/${leave.id}`} className="font-semibold text-[var(--accent)] hover:underline">
                              {leave.leaveType?.name ?? "General Leave"}
                            </Link>
                          </td>
                          <td className="px-3.5 py-2.5 align-middle font-medium">{leave.user.name}</td>
                          <td className="px-3.5 py-2.5 align-middle text-[var(--text-soft)]">{leave.manager?.name ?? "Unassigned"}</td>
                          <td className="px-3.5 py-2.5 align-middle text-[var(--text-soft)]">
                            {new Date(leave.startDate).toLocaleDateString()} – {new Date(leave.endDate).toLocaleDateString()}
                          </td>
                          <td className="px-3.5 py-2.5 align-middle">
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold border ${
                                isApproved
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                  : isRejected
                                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                                  : isPending
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                  : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                              }`}
                            >
                              {statusLabel(leave.status)}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 align-middle text-[var(--text-faint)]">
                            {new Date(leave.updatedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </CRMShell>
  );
}
