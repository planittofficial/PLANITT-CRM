"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { StatePanel } from "@/components/shared/state-panel";
import { renderSessionGate } from "@/components/shared/session-gate";
import { useCrmSearch } from "@/components/providers/crm-search-provider";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useSession } from "@/hooks/use-session";
import { apiGet, apiPost } from "@/lib/api";
import type { CRMUser, Department } from "@/types/crm";
import { showToast } from "@/hooks/use-toast";
type PaginatedResponse<T> = { items: T[]; total: number; hasMore: boolean; nextOffset: number };

function Surface({ children }: { children: ReactNode }) {
  return (
    <section
      className="rounded-[20px] border p-5"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      {children}
    </section>
  );
}

export default function DepartmentsPage() {
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession({
    allowedRoles: ["SUPERADMIN", "ADMIN"],
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaders, setLeaders] = useState<CRMUser[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [hasMoreDepartments, setHasMoreDepartments] = useState(false);
  const [nextDepartmentOffset, setNextDepartmentOffset] = useState(0);
  const [loadingMoreDepartments, setLoadingMoreDepartments] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    headId: "",
  });
  const { globalSearch, searchSubmitted } = useCrmSearch();

  const fieldStyle = {
    borderColor: "var(--border)",
    background: "var(--surface-soft)",
    color: "var(--text-main)",
  } as const;

  const loadData = async (append = false) => {
    const offset = append ? nextDepartmentOffset : 0;
    const [departmentPage, userData] = await Promise.all([
      apiGet<PaginatedResponse<Department>>(`/departments?paginate=true&limit=20&offset=${offset}`),
      apiGet<CRMUser[]>("/users"),
    ]);
    setDepartments((current) => (append ? [...current, ...departmentPage.items] : departmentPage.items));
    setHasMoreDepartments(departmentPage.hasMore);
    setNextDepartmentOffset(departmentPage.nextOffset);
    setLeaders(userData.filter((member) => ["SUPERADMIN", "ADMIN", "MANAGER"].includes(member.role)));
  };

  useEffect(() => {
    async function fetchData() {
      try {
        await loadData(false);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to load departments" , "error");
      } finally {
        setDataLoading(false);
      }
    }

    if (user) {
      void fetchData();
    }
  }, [user]);

  useRealtimeRefresh(user, ["org:updated"], async () => {
    await loadData(false);
  });

  const createDepartment = async () => {
    try {
      setCreating(true);
      setError("");
      setNotice("");
      await apiPost("/departments", form);
      setForm({
        name: "",
        code: "",
        description: "",
        headId: "",
      });
      await loadData(false);
      showToast("Department created successfully.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create department" , "error");
    } finally {
      setCreating(false);
    }
  };

  const departmentAnalytics = useMemo(() => {
    const total = departments.length;
    const totalMembers = departments.reduce((sum, department) => sum + (department._count?.users ?? 0), 0);
    const withHead = departments.filter((department) => Boolean(department.head?.id)).length;
    const avgMembers = total ? Math.round(totalMembers / total) : 0;
    const leadershipCoverage = total ? Math.round((withHead / total) * 100) : 0;
    return { total, totalMembers, avgMembers, leadershipCoverage };
  }, [departments]);
  const visibleDepartments = useMemo(() => {
    if (!searchSubmitted) return departments;
    const query = globalSearch.trim().toLowerCase();
    if (!query) return departments;
    return departments.filter((department) => {
      const inName = department.name.toLowerCase().includes(query);
      const inCode = department.code.toLowerCase().includes(query);
      const inDesc = (department.description ?? "").toLowerCase().includes(query);
      const inHead = (department.head?.name ?? "").toLowerCase().includes(query);
      return inName || inCode || inDesc || inHead;
    });
  }, [departments, globalSearch, searchSubmitted]);

  const sessionGate = renderSessionGate({
    loading: sessionLoading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading departments",
    loadingDescription: "Preparing organization structure.",
  });
  if (sessionGate) {
    return sessionGate;
  }

  if (!user) {
    return null;
  }

  return (
    <CRMShell user={user}>
      <div className="min-w-0 space-y-4 overflow-x-hidden pb-4">
        <Surface>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
            Organization design
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]">
            Departments
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
            Structure the company into technical, marketing, research, and operations teams with clearer ownership.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Departments", value: departmentAnalytics.total },
              { label: "Total members", value: departmentAnalytics.totalMembers },
              { label: "Avg members", value: departmentAnalytics.avgMembers },
              { label: "Head assigned", value: `${departmentAnalytics.leadershipCoverage}%` },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">{item.label}</p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-main)]">{item.value}</p>
              </div>
            ))}
          </div>
        </Surface>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <Surface>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
              Create department
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--text-main)]">Add a new business unit</h2>

            <div className="mt-5 grid gap-4">
              <input
                className="h-12 rounded-2xl border px-4 outline-none"
                style={fieldStyle}
                placeholder="Department name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
              <input
                className="h-12 rounded-2xl border px-4 uppercase outline-none"
                style={fieldStyle}
                placeholder="Code (e.g. TECH)"
                value={form.code}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              />
              <textarea
                className="min-h-28 rounded-2xl border px-4 py-3 outline-none"
                style={fieldStyle}
                placeholder="Description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
              <select
                className="h-12 rounded-2xl border px-4 outline-none"
                style={fieldStyle}
                value={form.headId}
                onChange={(event) => setForm((current) => ({ ...current, headId: event.target.value }))}
              >
                <option value="">Select department head</option>
                {leaders.map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.name} - {leader.role}
                  </option>
                ))}
              </select>

              {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
              {notice ? <p className="text-sm font-medium text-emerald-600">{notice}</p> : null}

              <button
                type="button"
                disabled={creating}
                onClick={() => void createDepartment()}
                className="h-12 rounded-2xl text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-70"
                style={{ background: "var(--accent-strong)" }}
              >
                {creating ? "Creating..." : "Create department"}
              </button>
            </div>
          </Surface>

          <Surface>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                  Current structure
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--text-main)]">Department list</h2>
              </div>
              <span className="text-sm text-[var(--text-soft)]">{visibleDepartments.length} departments</span>
            </div>

            {dataLoading ? <p className="mt-6 text-sm text-[var(--text-soft)]">Loading departments...</p> : null}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {visibleDepartments.map((department) => (
                <article
                  key={department.id}
                  className="rounded-[18px] border p-4"
                  style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                        {department.code}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-[var(--text-main)]">
                        {department.name}
                      </h3>
                    </div>
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ background: "var(--surface)", color: "var(--text-soft)" }}
                    >
                      {department._count?.users ?? 0} members
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">
                    {department.description || "No description added yet."}
                  </p>
                  <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[var(--text-faint)]">
                    Head
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--text-main)]">
                    {department.head?.name || "Not assigned"}
                  </p>
                </article>
              ))}
            </div>
            {hasMoreDepartments ? (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMoreDepartments}
                  onClick={() => {
                    setLoadingMoreDepartments(true);
                    void loadData(true).finally(() => setLoadingMoreDepartments(false));
                  }}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                >
                  {loadingMoreDepartments ? "Loading..." : "Load more departments"}
                </button>
              </div>
            ) : null}
          </Surface>
        </div>
      </div>
    </CRMShell>
  );
}
