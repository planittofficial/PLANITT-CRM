"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { ResponsiveSelect } from "@/components/shared/responsive-select";
import { StatePanel } from "@/components/shared/state-panel";
import { renderSessionGate } from "@/components/shared/session-gate";
import { useCrmSearch } from "@/components/providers/crm-search-provider";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useSession } from "@/hooks/use-session";
import { EmployeesSkeleton } from "@/components/shared/skeleton";
import { SearchIcon, PlusIcon, Building2Icon, UsersIcon } from "@/components/ui/icons";
import { apiGet, apiPost } from "@/lib/api";
import type { CRMUser, Department } from "@/types/crm";
import { showToast } from "@/hooks/use-toast";

type PaginatedResponse<T> = { items: T[]; total: number; hasMore: boolean; nextOffset: number };

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5 shadow-xs ${className}`}
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
  const [smartPasteText, setSmartPasteText] = useState("");
  const [showSmartPaste, setShowSmartPaste] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingMoreDepartments, setLoadingMoreDepartments] = useState(false);
  const [error, setError] = useState("");
  const [expandedDepartmentId, setExpandedDepartmentId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    headId: "",
  });
  const { globalSearch, searchSubmitted } = useCrmSearch();
  const leaderOptions = useMemo(
    () => [{ value: "", label: "Select department head" }, ...leaders.map((leader) => ({ value: leader.id, label: `${leader.name} - ${leader.role}` }))],
    [leaders]
  );

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
        showToast(err instanceof Error ? err.message : "Failed to load departments", "error");
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
      setShowCreateForm(false);
      await loadData(false);
      showToast("Department created successfully.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create department", "error");
    } finally {
      setCreating(false);
    }
  };

  function handleDepartmentSmartPaste() {
    const text = smartPasteText;
    const name = text.match(/Department:\s*(.+)/i)?.[1]?.trim() ?? "";
    const code = text.match(/Code:\s*(.+)/i)?.[1]?.trim() ?? "";
    const description = text.match(/Description:\s*([\s\S]*)/i)?.[1]?.trim() ?? "";

    setForm((current) => ({
      ...current,
      name,
      code,
      description,
    }));

    showToast("Department fields auto-filled", "success");
  }

  const departmentAnalytics = useMemo(() => {
    const total = departments.length;
    const totalMembers = departments.reduce((sum, department) => sum + (department._count?.users ?? 0), 0);
    const withHead = departments.filter((department) => Boolean(department.head?.id)).length;
    const avgMembers = total ? Math.round(totalMembers / total) : 0;
    const leadershipCoverage = total ? Math.round((withHead / total) * 100) : 0;
    return { total, totalMembers, avgMembers, leadershipCoverage };
  }, [departments]);

  const visibleDepartments = useMemo(() => {
    const query = (searchQuery || (searchSubmitted ? globalSearch : "")).trim().toLowerCase();
    if (!query) return departments;
    return departments.filter((department) => {
      const inName = department.name.toLowerCase().includes(query);
      const inCode = department.code.toLowerCase().includes(query);
      const inDesc = (department.description ?? "").toLowerCase().includes(query);
      const inHead = (department.head?.name ?? "").toLowerCase().includes(query);
      return inName || inCode || inDesc || inHead;
    });
  }, [departments, globalSearch, searchSubmitted, searchQuery]);

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

  if (dataLoading) {
    return (
      <CRMShell user={user}>
        <EmployeesSkeleton />
      </CRMShell>
    );
  }

  return (
    <CRMShell user={user}>
      <div className="min-w-0 space-y-3 sm:space-y-4 overflow-x-hidden pb-4">
        {/* Unified Mobile Department Workspace Card (sm:hidden) */}
        <div className="sm:hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2.5 space-y-2 shadow-xs">
          {/* Row 1: Search + Add Department Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={14} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search departments..."
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] pl-8.5 pr-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-strong)] px-3 text-xs font-semibold text-white shadow-xs transition-colors"
            >
              <PlusIcon size={14} />
              <span>{showCreateForm ? "Close" : "Dept"}</span>
            </button>
          </div>

          {/* Row 2: Metrics / Status strip */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex h-8 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-0.5 text-xs">
              <span className="flex h-7 items-center rounded-md bg-[var(--surface)] px-2.5 font-semibold text-[var(--accent)] shadow-xs">
                {departmentAnalytics.total} Depts
              </span>
              <span className="flex h-7 items-center px-2 text-[var(--text-soft)]">
                {departmentAnalytics.totalMembers} Members
              </span>
            </div>
            <div className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 text-[11px] font-medium text-[var(--text-main)]">
              <span className="text-[var(--text-soft)]">Assigned:</span>
              <span className="font-bold text-[var(--accent)]">{departmentAnalytics.leadershipCoverage}%</span>
            </div>
          </div>
        </div>

        {/* Desktop Header & Stats Card */}
        <Surface className="hidden sm:block">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-[var(--accent)] border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                  Organization Design
                </span>
                <span className="text-xs text-[var(--text-soft)]">Structure & Teams</span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-main)]">
                Departments
              </h1>
              <p className="mt-0.5 text-xs text-[var(--text-soft)]">
                Structure the company into technical, marketing, research, and operations teams with clearer ownership.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-strong)] px-3.5 text-xs font-semibold text-white shadow-xs transition-colors"
            >
              <PlusIcon size={14} />
              <span>{showCreateForm ? "Hide Form" : "New Department"}</span>
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Departments", value: departmentAnalytics.total },
              { label: "Total Members", value: departmentAnalytics.totalMembers },
              { label: "Avg Members", value: departmentAnalytics.avgMembers },
              { label: "Head Assigned", value: `${departmentAnalytics.leadershipCoverage}%` },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3.5 py-2.5"
              >
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)] font-medium">{item.label}</p>
                <p className="mt-1 text-xl font-bold text-[var(--text-main)]">{item.value}</p>
              </div>
            ))}
          </div>
        </Surface>

        {/* Layout Grid: Create Form + Department List */}
        <div className={`grid gap-3 sm:gap-4 ${showCreateForm ? "xl:grid-cols-[400px_1fr]" : "grid-cols-1"}`}>
          {showCreateForm && (
            <Surface>
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-main)]">Create Department</h2>
                  <p className="text-[11px] text-[var(--text-soft)]">Add a new operational business unit</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSmartPaste(!showSmartPaste)}
                  className="h-7 rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-2 text-[11px] font-medium text-[var(--text-soft)] hover:text-[var(--text-main)] transition-colors"
                >
                  {showSmartPaste ? "Hide Template" : "✨ Smart Paste"}
                </button>
              </div>

              {showSmartPaste && (
                <div className="mt-3 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                  <p className="text-[11px] text-[var(--text-soft)]">
                    Paste text matching template, then click auto-fill:
                  </p>
                  <textarea
                    className="h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-xs outline-none focus:border-[var(--accent)]"
                    placeholder="Department: Technical&#10;Code: TECH&#10;Description: Infrastructure..."
                    value={smartPasteText}
                    onChange={(e) => setSmartPasteText(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleDepartmentSmartPaste}
                    className="h-8 w-full rounded-lg bg-[var(--accent)] text-xs font-semibold text-white shadow-xs transition-colors"
                  >
                    ✨ Auto-fill Fields
                  </button>
                </div>
              )}

              <div className="mt-3.5 space-y-2.5">
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-soft)] mb-1 block">Department Name</label>
                  <input
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                    placeholder="e.g. Technical Operations"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-soft)] mb-1 block">Code</label>
                  <input
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 uppercase text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                    placeholder="e.g. TECH"
                    value={form.code}
                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-soft)] mb-1 block">Description</label>
                  <textarea
                    className="h-20 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                    placeholder="Department mission and responsibilities..."
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-soft)] mb-1 block">Department Head</label>
                  <ResponsiveSelect
                    value={form.headId}
                    onChange={(value) => setForm((current) => ({ ...current, headId: value }))}
                    options={leaderOptions}
                    ariaLabel="Select department head"
                    buttonClassName="h-9 rounded-lg text-xs px-3"
                  />
                </div>

                {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
                {notice ? <p className="text-xs font-medium text-emerald-600">{notice}</p> : null}

                <div className="pt-1 flex gap-2">
                  <button
                    type="button"
                    disabled={creating || !form.name.trim() || !form.code.trim()}
                    onClick={() => void createDepartment()}
                    className="h-9 flex-1 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 shadow-xs"
                  >
                    {creating ? "Creating..." : "Save Department"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-medium text-[var(--text-soft)] hover:text-[var(--text-main)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </Surface>
          )}

          <Surface className="flex-1">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-main)]">Department Directory</h2>
                <p className="text-[11px] text-[var(--text-soft)]">{visibleDepartments.length} registered units</p>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <div className="relative w-64">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={14} />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, code, head..."
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] pl-8.5 pr-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            </div>

            {visibleDepartments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-xs text-[var(--text-soft)] mt-4">
                No departments match your search.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {visibleDepartments.map((department) => {
                  const isExpanded = expandedDepartmentId === department.id;
                  return (
                    <article
                      key={department.id}
                      onClick={() => setExpandedDepartmentId(isExpanded ? null : department.id)}
                      className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3.5 transition hover:border-[var(--accent)] shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-[var(--accent)] border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                            {department.code}
                          </span>
                          <h3 className="text-sm font-bold text-[var(--text-main)] truncate">
                            {department.name}
                          </h3>
                        </div>
                        <span className="shrink-0 rounded-full bg-[var(--surface)] border border-[var(--border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-soft)]">
                          {department._count?.users ?? 0} members
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-[var(--text-soft)] line-clamp-2">
                        {department.description || "No description provided."}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex items-center justify-between text-xs">
                        <span className="text-[var(--text-faint)]">Head:</span>
                        <span className="font-semibold text-[var(--text-main)]">
                          {department.head?.name ? (
                            <span className="text-[var(--accent)]">{department.head.name}</span>
                          ) : (
                            <span className="text-[var(--text-faint)] italic">Not assigned</span>
                          )}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 border-t border-[var(--border)] pt-3 text-xs space-y-2">
                          <div>
                            <span className="text-[var(--text-faint)] block text-[10px] uppercase tracking-wider">Role of Head:</span>
                            <span className="text-[var(--text-main)] font-medium">{department.head?.role || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-[var(--text-faint)] block text-[10px] uppercase tracking-wider">Full Overview:</span>
                            <span className="text-[var(--text-soft)]">{department.description || "No full description."}</span>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {hasMoreDepartments ? (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMoreDepartments}
                  onClick={() => {
                    setLoadingMoreDepartments(true);
                    void loadData(true).finally(() => setLoadingMoreDepartments(false));
                  }}
                  className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-hover)] disabled:opacity-60 transition-colors shadow-xs"
                >
                  {loadingMoreDepartments ? "Loading..." : "Load More Departments"}
                </button>
              </div>
            ) : null}
          </Surface>
        </div>
      </div>
    </CRMShell>
  );
}
