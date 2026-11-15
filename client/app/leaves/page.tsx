"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { CRMShell } from "@/components/layout/crm-shell";
import { ResponsiveSelect } from "@/components/shared/responsive-select";
import { renderSessionGate } from "@/components/shared/session-gate";
import { EmployeesSkeleton } from "@/components/shared/skeleton";
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

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(event.target.value);
  };

  return (
    <CRMShell user={user}>
      <div className="min-w-0 space-y-4 overflow-x-hidden pb-4">
        {/* Teams Header */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-[var(--accent)] border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                  Human Resources
                </span>
                <span className="text-xs text-[var(--text-soft)]">Time Off</span>
              </div>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl">Leaves & Absences</h1>
              <p className="mt-0.5 text-xs text-[var(--text-soft)]">
                Submit leave requests, review team approvals, and track status.
              </p>
            </div>
            <Link
              href="/leaves/new"
              className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-strong)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors"
            >
              Apply for Leave
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-main)]">Leave Requests</h3>
              <p className="text-xs text-[var(--text-soft)]">{filteredLeaves.length} requests in record</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={handleSearchChange}
                className="h-8.5 w-full sm:w-64 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                placeholder="Search type, requester, manager..."
              />
              <ResponsiveSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusSelectOptions}
                ariaLabel="Filter leave requests by status"
                buttonClassName="h-8.5 rounded-md text-xs px-3"
              />
            </div>
          </div>

          {loading ? (
            <p className="py-8 text-center text-xs text-[var(--text-soft)]">Loading leave requests...</p>
          ) : error ? (
            <p className="py-8 text-center text-xs text-rose-600">{error}</p>
          ) : filteredLeaves.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-xs text-[var(--text-soft)]">
              No leave requests match your search or filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)] crm-table-scroll">
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
          )}
        </section>
      </div>
    </CRMShell>
  );
}
