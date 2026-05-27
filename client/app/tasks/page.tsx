"use client";

import { Suspense, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { useCrmSearch } from "@/components/providers/crm-search-provider";
import { TaskList } from "@/components/modules/task-list";
import { StatePanel } from "@/components/shared/state-panel";
import { renderSessionGate } from "@/components/shared/session-gate";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useSession } from "@/hooks/use-session";
import { MemberPickerToolbar, type MemberRoleFilter } from "@/components/shared/member-picker-toolbar";
import { LoadingRows } from "@/components/shared/loading-skeleton";
import { usePaginatedDirectoryUsers } from "@/hooks/use-paginated-directory-users";
import { apiGet, apiPost } from "@/lib/api";
import { getTaskAssignableRoles, isAdminRole } from "@/lib/dashboard";
import { useSearchParams } from "next/navigation";
import { TASK_PRIORITY_OPTIONS } from "@/lib/task-groups";
import type { CRMUser, Project, Task, TaskPriority } from "@/types/crm";
type PaginatedResponse<T> = { items: T[]; total: number; hasMore: boolean; nextOffset: number };

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[20px] border p-5 ${className}`.trim()}
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

function TasksPageContent() {
  const searchParams = useSearchParams();
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [tasksTotal, setTasksTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreTasks, setHasMoreTasks] = useState(false);
  const [nextTaskOffset, setNextTaskOffset] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    userIds: [] as string[],
    progress: 0,
    checklistText: "",
    priority: "MEDIUM" as TaskPriority,
    deadlineAt: "",
  });
  const [assignPickerQuery, setAssignPickerQuery] = useState("");
  const [assignPickerRole, setAssignPickerRole] = useState<MemberRoleFilter>("ALL");
  const {
 globalSearch,
 searchSubmitted,
 resetSearch
}
=
useCrmSearch();
  const taskSearch = useDeferredValue(globalSearch.trim());
  const fieldStyle = {
    borderColor: "var(--border)",
    background: "var(--surface-soft)",
    color: "var(--text-main)",
  } as const;

  const initialIssueTaskId = searchParams.get("taskId");
  const initialIssueId = searchParams.get("issueId");
  const taskAssignableRoles = useMemo(
    () => (user ? getTaskAssignableRoles(user.role) : []),
    [user]
  );
  const assignPickerRoleOptions = useMemo(
    () => [...taskAssignableRoles].sort((a, b) => a.localeCompare(b)),
    [taskAssignableRoles]
  );

  const directory = usePaginatedDirectoryUsers({
    limit: 16,
    roleFilter: assignPickerRole,
    searchQuery: assignPickerQuery,
    enabled: Boolean(user && isAdminRole(user.role)),
  });
  const teamForTaskList = useMemo(() => {
    const byId = new Map(directory.items.map((u) => [u.id, u]));
    for (const task of tasks) {
      for (const a of task.assignments) {
        if (!byId.has(a.userId)) {
          byId.set(a.userId, {
            id: a.user.id,
            name: a.user.name,
            email: "—",
            role: a.user.role,
            designation: null,
            departmentId: null,
            department: null,
            managerId: null,
            manager: null,
          });
        }
      }
    }
    return [...byId.values()];
  }, [directory.items, tasks]);

  const taskAnalytics = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((task) => task.status === "DONE").length;
    const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS").length;
    const todo = tasks.filter((task) => task.status === "TODO").length;
    const completionRate = total ? Math.round((done / total) * 100) : 0;
    const avgProgress = total
      ? Math.round(tasks.reduce((sum, task) => sum + (task.progress || 0), 0) / total)
      : 0;
    return { total, done, inProgress, todo, completionRate, avgProgress };
  }, [tasks]);

  const getTaskDeadline = (task: Task) => {
    const explicit =
      (task as Task & { deadline?: string | null; dueDate?: string | null; dueAt?: string | null })
        .deadline ??
      (task as Task & { deadline?: string | null; dueDate?: string | null; dueAt?: string | null })
        .dueDate ??
      (task as Task & { deadline?: string | null; dueDate?: string | null; dueAt?: string | null })
        .dueAt ??
      null;
    if (explicit) {
      const parsed = new Date(explicit);
      if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    }
    const desc = task.description ?? "";
    const match = desc.match(/deadline\s*[:\-]\s*([^\n\r]+)/i);
    if (!match?.[1]) return null;
    const parsed = new Date(match[1].trim());
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  };

  const sortedTasks = useMemo(() => {
    const now = Date.now();
    const copy = [...tasks];
    copy.sort((a, b) => {
      const da = getTaskDeadline(a);
      const db = getTaskDeadline(b);
      if (da !== null && db !== null) {
        const aOverdue = da < now ? 1 : 0;
        const bOverdue = db < now ? 1 : 0;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;
        return da - db;
      }
      if (da !== null) return -1;
      if (db !== null) return 1;
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bCreated - aCreated;
    });
    return copy;
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const query = nameFilter.trim().toLowerCase();
    if (!query) return sortedTasks;
    return sortedTasks.filter((task) => {
      const inTitle = task.title.toLowerCase().includes(query);
      const inDescription = (task.description ?? "").toLowerCase().includes(query);
      const inAssignee = task.assignments.some((a) => a.user.name.toLowerCase().includes(query));
      return inTitle || inDescription || inAssignee;
    });
  }, [sortedTasks, nameFilter]);

  const loadTasks = async (append = false) => {
    const offset = append ? nextTaskOffset : 0;
    const params = new URLSearchParams({
      paginate: "true",
      limit: "30",
      offset: String(offset),
    });
    if (
  searchSubmitted &&
  taskSearch
) {
  params.set(
    "q",
    taskSearch
  );
}
    const data = await apiGet<PaginatedResponse<Task>>(`/tasks?${params.toString()}`);
    const projectFilter =
      selectedProjectId !== "ALL" ? `&projectId=${encodeURIComponent(selectedProjectId)}` : "";
    const data = await apiGet<PaginatedResponse<Task>>(
      `/tasks?paginate=true&limit=30&offset=${offset}${projectFilter}`
    );
    setTasks((current) => (append ? [...current, ...data.items] : data.items));
    setTasksTotal(data.total);
    setHasMoreTasks(data.hasMore);
    setNextTaskOffset(data.nextOffset);
  };

  const loadProjects = async () => {
    const data = await apiGet<PaginatedResponse<Project>>("/projects?paginate=true&limit=200&offset=0");
    setProjects(data.items);
  };

  useEffect(() => {
    if (!searchSubmitted) return;
    async function fetchData() {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadTasks(false), loadProjects()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tasks");
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      void fetchData();
    }
  }, [user, taskSearch]);
  }, [user, selectedProjectId]);

  useRealtimeRefresh(user, ["task:updated", "issue:updated", "org:updated"], async () => {
    await loadTasks(false);

  });

  const handleAssigneeToggle = (userId: string) => {
    setForm((current) => ({
      ...current,
      userIds: current.userIds.includes(userId)
        ? current.userIds.filter((id) => id !== userId)
        : [...current.userIds, userId],
    }));
  };

  const createTask = async () => {
    try {
      setCreating(true);
      setError("");
      setNotice("");
      await apiPost("/tasks", {
        title: form.title,
        description: form.description,
        userIds: form.userIds,
        progress: form.progress,
        priority: form.priority,
        deadlineAt: form.deadlineAt || null,
        checklistItems: form.checklistText
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setForm({ title: "", description: "", userIds: [], progress: 0, checklistText: "", priority: "MEDIUM", deadlineAt: "" });
      setNotice("Task created successfully.");
      await loadTasks(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  const sessionGate = renderSessionGate({
    loading: sessionLoading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading tasks",
    loadingDescription: "Preparing the task workspace.",
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--text-faint)">
            Task workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-(--text-main)">Tasks</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-(--text-soft)">
            {isAdminRole(user.role)
              ? "Create and assign work in a focused workspace without oversized panels."
              : "Review assignments, update progress, and report blockers from one clean view."}
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "All tasks", value: taskAnalytics.total },
              { label: "Done", value: taskAnalytics.done },
              { label: "In progress", value: taskAnalytics.inProgress },
              { label: "Todo", value: taskAnalytics.todo },
              { label: "Completion", value: `${taskAnalytics.completionRate}%` },
              { label: "Avg progress", value: `${taskAnalytics.avgProgress}%` },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-(--text-faint)">{item.label}</p>
                <p className="mt-2 text-xl font-semibold text-(--text-main)">{item.value}</p>
              </div>
            ))}
          </div>
        </Surface>

        <div className="grid gap-4 lg:grid-cols-1 xl:grid-cols-[minmax(280px,380px)_1fr] xl:items-start">
          {isAdminRole(user.role) ? (
            <Surface className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--text-faint)">
                Create task
              </p>
              <h2 className="mt-2 text-xl font-semibold text-(--text-main)">Assign work clearly</h2>

              <div className="mt-5 grid gap-4">
                <input
                  className="h-12 rounded-2xl border px-4 outline-none"
                  style={fieldStyle}
                  placeholder="Task title"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                />
                <textarea
                  className="min-h-28 rounded-2xl border px-4 py-3 outline-none"
                  style={fieldStyle}
                  placeholder="Task description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-[var(--text-main)]">Deadline</span>
                  <input
                    type="datetime-local"
                    className="h-12 rounded-2xl border px-4 text-sm outline-none"
                    style={fieldStyle}
                    value={form.deadlineAt}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, deadlineAt: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-(--text-main)">Priority</span>
                  <select
                    className="h-12 rounded-2xl border px-4 text-sm outline-none"
                    style={fieldStyle}
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        priority: event.target.value as TaskPriority,
                      }))
                    }
                  >
                    {TASK_PRIORITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <textarea
                  className="min-h-32 rounded-2xl border px-4 py-3 outline-none"
                  style={fieldStyle}
                  placeholder={"Checklist items, one per line\nExample:\nCreate first draft\nReview with manager\nSubmit final work"}
                  value={form.checklistText}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, checklistText: event.target.value }))
                  }
                />

                <div>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <p className="text-sm font-medium text-(--text-main)">Assign to team members</p>
                    <span className="text-xs text-(--text-soft)">
                      {directory.loading
                        ? "Searching…"
                        : `Showing ${directory.items.length} of ${directory.total}`}
                    </span>
                  </div>
                  {form.userIds.length ? (
                    <p className="mt-2 text-xs text-(--text-soft)">
                      Selected:{" "}
                      {form.userIds
                        .map((id) => teamForTaskList.find((m) => m.id === id)?.name ?? id.slice(0, 8))
                        .join(", ")}
                    </p>
                  ) : null}
                  <div className="mt-3">
                    <MemberPickerToolbar
                      searchQuery={assignPickerQuery}
                      onSearchChange={setAssignPickerQuery}
                      roleFilter={assignPickerRole}
                      onRoleFilterChange={setAssignPickerRole}
                      roleOptions={assignPickerRoleOptions}
                    />
                  </div>
                  <div className="mt-3 max-h-[min(280px,40vh)] overflow-y-auto rounded-2xl border p-2" style={{ borderColor: "var(--border)" }}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {directory.loading && !directory.items.length ? (
                        <p className="col-span-full px-3 py-6 text-sm text-(--text-soft)">Loading directory…</p>
                      ) : directory.items.length === 0 ? (
                        <p className="col-span-full px-3 py-6 text-sm text-(--text-soft)">
                          No one matches this search. Try another name or clear filters.
                        </p>
                      ) : (
                        directory.items.map((member) => (
                          <label
                            key={member.id}
                            className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                            style={{
                              borderColor: "var(--border)",
                              background: "var(--surface-soft)",
                              color: "var(--text-main)",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={form.userIds.includes(member.id)}
                              onChange={() => handleAssigneeToggle(member.id)}
                            />
                            <span className="min-w-0 truncate">
                              {member.name} · {member.role}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  {directory.hasMore ? (
                    <div className="mt-3 flex justify-center">
                      <button
                        type="button"
                        disabled={directory.loadingMore}
                        onClick={() => void directory.loadMore()}
                        className="rounded-xl border px-4 py-2 text-xs font-semibold disabled:opacity-60"
                        style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                      >
                        {directory.loadingMore ? "Loading…" : "Load more people"}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-(--text-main)">Initial progress</p>
                    <span className="text-sm font-semibold text-(--text-main)">{form.progress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={form.progress}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        progress: Number(event.target.value),
                      }))
                    }
                    className="mt-3 w-full accent-slate-950"
                  />
                </div>

                {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
                {notice ? <p className="text-sm font-medium text-emerald-600">{notice}</p> : null}

                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void createTask()}
                  className="h-12 rounded-2xl text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-70"
                  style={{ background: "var(--accent-strong)" }}
                >
                  {creating ? "Creating..." : "Create task"}
                </button>
              </div>
            </Surface>
          ) : (
            <Surface>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--text-faint)">
                Personal workflow
              </p>
              <h2 className="mt-2 text-xl font-semibold text-(--text-main)">Keep your queue updated</h2>
              <p className="mt-3 text-sm leading-6 text-(--text-soft)">
                Use this page to review assignments and move work from Todo to In Progress and Done.
              </p>
            </Surface>
          )}

          <Surface>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--text-faint)">
                  Open list
                </p>
                <h2 className="mt-2 text-xl font-semibold text-(--text-main)">Current tasks</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFilterOpen((current) => !current)}
                  className="h-9 rounded-xl border px-3 text-sm font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--text-main)", background: "var(--surface-soft)" }}
                >
                  {filterOpen ? "Hide Filters" : "Filter"}
                </button>
                <span className="text-sm tabular-nums text-(--text-soft)">
                  {tasksTotal ? `Showing ${visibleTasks.length} of ${tasksTotal}` : `${visibleTasks.length} loaded`}
                </span>
              </div>
              <span className="text-sm tabular-nums text-[var(--text-soft)]">
                {loading
                  ? taskSearch
                    ? "Searching..."
                    : "Loading..."
                  : tasks.length === 0
                    ? taskSearch
                      ? `No results found for "${taskSearch}"`
                      : "No tasks available yet."
                    : tasksTotal
                      ? `Showing ${tasks.length} of ${tasksTotal}`
                      : `${tasks.length} loaded`}
              </span>
            </div>
            {filterOpen ? (
              <div
                className="mt-4 grid gap-3 rounded-2xl border p-3 md:grid-cols-[minmax(220px,320px)_minmax(0,1fr)]"
                style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
              >
                <label className="grid min-w-0 gap-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-(--text-soft)">Project</span>
                  <select
                    className="h-10 w-full rounded-xl border px-3 text-sm outline-none"
                    style={fieldStyle}
                    value={selectedProjectId}
                    onChange={(event) => {
                      setSelectedProjectId(event.target.value);
                      setLoading(true);
                    }}
                  >
                    <option value="ALL">All projects</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid min-w-0 gap-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-(--text-soft)">Task Name</span>
                  <input
                    className="h-10 w-full min-w-0 rounded-xl border px-3 text-sm outline-none"
                    style={fieldStyle}
                    value={nameFilter}
                    placeholder="Search title, description, assignee"
                    onChange={(event) => setNameFilter(event.target.value)}
                  />
                </label>
              </div>
            ) : null}

            {loading ? <p className="mt-6 text-sm text-(--text-soft)">Loading tasks...</p> : null}
            {!loading && error ? <p className="mt-6 text-sm font-medium text-rose-600">{error}</p> : null}

            

            <div className="mt-6 max-h-[min(70vh,900px)] overflow-y-auto pr-1">
              {!loading && tasks.length > 0 ? (
              {visibleTasks.length ? (
                <TaskList
                  tasks={visibleTasks}
                  user={user}
                  team={teamForTaskList}
                  onUpdated={() => void loadTasks(false)}
                  initialIssueTaskId={initialIssueTaskId}
                  initialIssueId={initialIssueId}
                />
              ) : !loading && !error ? (
                <div
                  className="rounded-3xl border border-dashed p-8 text-sm"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface-soft)",
                    color: "var(--text-soft)",
                  }}
                >
                  {taskSearch ? `No results found for "${taskSearch}".` : "No tasks available yet."}
                  No tasks match the current filters.
                </div>
              ) : null}
              {!loading && hasMoreTasks ? (
                <div className="sticky bottom-0 mt-4 flex justify-center border-t pt-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => {
                      setLoadingMore(true);
                      void loadTasks(true).finally(() => setLoadingMore(false));
                    }}
                    className="w-full max-w-md rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60 sm:w-auto"
                    style={{ background: "var(--accent-strong)" }}
                  >
                    {loadingMore
                      ? "Loading…"
                      : `Load more tasks (${Math.max(0, tasksTotal - tasks.length)} remaining)`}
                  </button>
                </div>
              ) : null}
            </div>
          </Surface>
        </div>
      </div>
    </CRMShell>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<StatePanel title="Loading tasks" description="Preparing the task workspace." />}>
      <TasksPageContent />
    </Suspense>
  );
}

