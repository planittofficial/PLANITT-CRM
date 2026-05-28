"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { CRMShell } from "@/components/layout/crm-shell";
import { renderSessionGate } from "@/components/shared/session-gate";
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

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(event.target.value);
  };

  return (
    <CRMShell user={user}>
      <div className="min-w-0 space-y-4 overflow-x-hidden pb-4">
        <section className="rounded-[20px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Leave management</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]">Leaves</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
                Create leave requests, review approvals, and track conversations for all requests.
              </p>
            </div>
            <Link href="/leaves/new" className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500">
              Apply for leave
            </Link>
          </div>
        </section>

        <section className="rounded-[20px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-main)]">Leave history</p>
              <p className="mt-1 text-sm text-[var(--text-soft)]">{filteredLeaves.length} requests found</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:auto-cols-fr xl:grid-flow-col xl:items-center">
              <label className="block">
                <span className="sr-only">Search leaves</span>
                <input
                  type="search"
                  value={search}
                  onChange={handleSearchChange}
                  className="crm-input h-12 w-full rounded-2xl border bg-[var(--surface-soft)] px-4 text-sm"
                  placeholder="Search by type, requester, manager, or reason"
                />
              </label>
              <label className="block">
                <span className="sr-only">Filter by status</span>
                <select
                  value={statusFilter}
                  onChange={handleStatusChange}
                  className="crm-input h-12 w-full rounded-2xl border bg-[var(--surface-soft)] px-4 text-sm"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-[var(--text-soft)]">Loading leave requests...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : filteredLeaves.length === 0 ? (
            <p className="text-sm text-[var(--text-soft)]">No leave requests match your search.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.2em] text-[var(--text-faint)]">
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Requester</th>
                    <th className="px-3 py-3">Manager</th>
                    <th className="px-3 py-3">Period</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.map((leave) => (
                    <tr key={leave.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface-soft)]">
                      <td className="px-3 py-3 align-top">
                        <Link href={`/leaves/${leave.id}`} className="font-semibold text-[var(--text-main)] hover:underline">
                          {leave.leaveType?.name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-3 py-3 align-top">{leave.user.name}</td>
                      <td className="px-3 py-3 align-top">{leave.manager?.name ?? "Not assigned"}</td>
                      <td className="px-3 py-3 align-top">
                        {new Date(leave.startDate).toLocaleDateString()} – {new Date(leave.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {statusLabel(leave.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">{new Date(leave.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </CRMShell>
  );
}
