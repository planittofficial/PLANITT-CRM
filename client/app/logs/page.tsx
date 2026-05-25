"use client";

import { useEffect, useMemo, useState } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { renderSessionGate } from "@/components/shared/session-gate";
import { StatePanel } from "@/components/shared/state-panel";
import { useSession } from "@/hooks/use-session";
import { apiGet } from "@/lib/api";
import type { ActivityLogsResponse, UserRole } from "@/types/crm";

const PAGE_SIZE = 40;

function toIsoDateStart(dateValue: string) {
  if (!dateValue) return "";
  return new Date(`${dateValue}T00:00:00.000Z`).toISOString();
}

function toIsoDateEnd(dateValue: string) {
  if (!dateValue) return "";
  return new Date(`${dateValue}T23:59:59.999Z`).toISOString();
}

export default function LogsPage() {
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession({
    allowedRoles: ["SUPERADMIN", "ADMIN"],
  });

  const [data, setData] = useState<ActivityLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [method, setMethod] = useState("");
  const [statusCode, setStatusCode] = useState("");
  const [userId, setUserId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [offset, setOffset] = useState(0);

  const loadLogs = async (nextOffset = 0) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(nextOffset));
      if (q.trim()) params.set("q", q.trim());
      if (role) params.set("role", role);
      if (method) params.set("method", method);
      if (statusCode.trim()) params.set("statusCode", statusCode.trim());
      if (userId.trim()) params.set("userId", userId.trim());
      if (fromDate) params.set("from", toIsoDateStart(fromDate));
      if (toDate) params.set("to", toIsoDateEnd(toDate));

      const result = await apiGet<ActivityLogsResponse>(`/activity-logs?${params.toString()}`);
      setData(result);
      setOffset(nextOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    void loadLogs(0);
  }, [user]);

  const statusSummary = useMemo(() => {
    const logs = data?.items ?? [];
    const ok = logs.filter((item) => item.statusCode >= 200 && item.statusCode < 300).length;
    const warnings = logs.filter((item) => item.statusCode >= 400 && item.statusCode < 500).length;
    const failures = logs.filter((item) => item.statusCode >= 500).length;
    return { ok, warnings, failures };
  }, [data?.items]);

  const sessionGate = renderSessionGate({
    loading: sessionLoading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading logs",
    loadingDescription: "Checking access and preparing audit logs.",
  });
  if (sessionGate) return sessionGate;
  if (!user) return null;

  return (
    <CRMShell user={user}>
      <div className="space-y-4">
        <section
          className="rounded-2xl border p-5"
          style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-soft)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">Audit center</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">Activity logs</h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            Track who did what across the CRM. Use filters to narrow down actions quickly.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 md:max-w-xl">
            <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)]">Success</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{statusSummary.ok}</p>
            </div>
            <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)]">Client errors</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{statusSummary.warnings}</p>
            </div>
            <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)]">Server errors</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{statusSummary.failures}</p>
            </div>
          </div>
        </section>

        <section
          className="rounded-2xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-soft)" }}
        >
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action/path/method" className="rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }} />
            <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Filter by user ID" className="rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }} />
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole | "")} className="rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}>
              <option value="">All roles</option>
              {["SUPERADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "INTERN"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}>
              <option value="">All methods</option>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input value={statusCode} onChange={(e) => setStatusCode(e.target.value)} placeholder="Status code (200/404...)" className="rounded-xl border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }} />
            <label className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}>
              <span className="mr-2 text-xs text-[var(--text-faint)]">From</span>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-transparent outline-none" />
            </label>
            <label className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}>
              <span className="mr-2 text-xs text-[var(--text-faint)]">To</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-transparent outline-none" />
            </label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void loadLogs(0)} className="h-10 rounded-xl px-4 text-sm font-semibold text-white" style={{ background: "var(--accent)" }}>
                Apply
              </button>
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setRole("");
                  setMethod("");
                  setStatusCode("");
                  setUserId("");
                  setFromDate("");
                  setToDate("");
                  void loadLogs(0);
                }}
                className="h-10 rounded-xl border px-4 text-sm font-semibold"
                style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        <section
          className="rounded-2xl border p-4"
          style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-soft)" }}
        >
          {error ? <StatePanel title="Unable to load logs" description={error} /> : null}
          {!error && loading ? <p className="text-sm text-[var(--text-soft)]">Loading logs...</p> : null}
          {!error && !loading && (!data || data.items.length === 0) ? (
            <StatePanel title="No logs found" description="Try broadening the filters and run again." />
          ) : null}
          {!error && !loading && data && data.items.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.14em] text-[var(--text-faint)]">
                      <th className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>Time</th>
                      <th className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>User</th>
                      <th className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>Role</th>
                      <th className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>Method</th>
                      <th className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>Status</th>
                      <th className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>Action</th>
                      <th className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>Path</th>
                      <th className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>UID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((log) => (
                      <tr key={log.id} className="text-sm text-[var(--text-main)]">
                        <td className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>{log.user?.name || "Unknown"}</td>
                        <td className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>{log.userRole}</td>
                        <td className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>{log.method}</td>
                        <td className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>{log.statusCode}</td>
                        <td className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>{log.action}</td>
                        <td className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>{log.path}</td>
                        <td className="border-b px-2 py-2 font-mono text-xs" style={{ borderColor: "var(--border)" }}>{log.userId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-[var(--text-soft)]">
                  Showing {offset + 1}-{offset + data.items.length} of {data.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={offset === 0}
                    onClick={() => void loadLogs(Math.max(0, offset - PAGE_SIZE))}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={!data.hasMore}
                    onClick={() => void loadLogs(offset + PAGE_SIZE)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </CRMShell>
  );
}
