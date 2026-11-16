"use client";

import { Suspense, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { useCrmSearch } from "@/components/providers/crm-search-provider";
import { TaskList } from "@/components/modules/task-list";
import { StatePanel } from "@/components/shared/state-panel";
import { renderSessionGate } from "@/components/shared/session-gate";
import { ResponsiveSelect } from "@/components/shared/responsive-select";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useSession } from "@/hooks/use-session";
import { MemberPickerToolbar, type MemberRoleFilter } from "@/components/shared/member-picker-toolbar";
import { usePaginatedDirectoryUsers } from "@/hooks/use-paginated-directory-users";
import { apiGet, apiPost } from "@/lib/api";
import { Skeleton } from "@/components/shared/skeleton";
import { getTaskAssignableRoles, isAdminRole } from "@/lib/dashboard";
import { useSearchParams } from "next/navigation";
import { parseSmartTaskPaste } from "@/lib/smart-paste";
import { TASK_PRIORITY_OPTIONS } from "@/lib/task-groups";
import { showToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Sheet } from "@/components/ui/sheet";
import { PlusIcon, FilterIcon, CheckSquareIcon } from "@/components/ui/icons";
import type { Task, Project, TaskPriority } from "@/types/crm";

type PaginatedResponse<T> = { items: T[]; total: number; hasMore: boolean; nextOffset: number };

function TasksPageContent() {
  const searchParams = useSearchParams();
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Task["status"]>("ALL");
  const [filterOpen, setFilterOpen] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [tasksTotal, setTasksTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreTasks, setHasMoreTasks] = useState(false);
  const [nextTaskOffset, setNextTaskOffset] = useState(0);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [smartPasteExpanded, setSmartPasteExpanded] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    userIds: [] as string[],
    progress: 0,
    checklistText: "",
    priority: "MEDIUM" as TaskPriority,
    deadlineAt: "",
  });

  const [smartPasteText, setSmartPasteText] = useState("");
  const [assignPickerQuery, setAssignPickerQuery] = useState("");
  const [assignPickerRole, setAssignPickerRole] = useState<MemberRoleFilter>("ALL");
  const { globalSearch, searchSubmitted } = useCrmSearch();
  const taskSearch = useDeferredValue(globalSearch.trim());

  const initialIssueTaskId = searchParams.get("taskId");
  const initialIssueId = searchParams.get("issueId");

  const taskAssignableRoles = useMemo(() => (user ? getTaskAssignableRoles(user.role) : []), [user]);
  const assignPickerRoleOptions = useMemo(() => [...taskAssignableRoles].sort((a, b) => a.localeCompare(b)), [taskAssignableRoles]);
  const projectFilterOptions = useMemo(() => [{ value: "ALL", label: "All projects" }, ...projects.map((p) => ({ value: p.id, label: p.name }))], [projects]);
  const priorityOptions = useMemo(() => TASK_PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label })), []);

  const directory = usePaginatedDirectoryUsers({
    limit: 100,
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
    const avgProgress = total ? Math.round(tasks.reduce((sum, task) => sum + (task.progress || 0), 0) / total) : 0;
    return { total, done, inProgress, todo, completionRate, avgProgress };
  }, [tasks]);

  const getTaskDeadline = (task: Task) => {
    const explicit =
      (task as Task & { deadline?: string | null; dueDate?: string | null; dueAt?: string | null }).deadline ??
      (task as Task & { deadline?: string | null; dueDate?: string | null; dueAt?: string | null }).dueDate ??
      (task as Task & { deadline?: string | null; dueDate?: string | null; dueAt?: string | null }).dueAt ??
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
    let result = sortedTasks;
    if (statusFilter !== "ALL") {
      result = result.filter((task) => task.status === statusFilter);
    }
    const query = nameFilter.trim().toLowerCase();
    if (!query) return result;
    return result.filter((task) => {
      const inTitle = task.title.toLowerCase().includes(query);
      const inDescription = (task.description ?? "").toLowerCase().includes(query);
      const inAssignee = task.assignments.some((a) => a.user.name.toLowerCase().includes(query));
      return inTitle || inDescription || inAssignee;
    });
  }, [sortedTasks, statusFilter, nameFilter]);

  const loadTasks = async (append = false) => {
    const offset = append ? nextTaskOffset : 0;
    const params = new URLSearchParams({
      paginate: "true",
      limit: "30",
      offset: String(offset),
    });

    if (selectedProjectId !== "ALL") {
      params.set("projectId", selectedProjectId);
    }
    if (searchSubmitted && taskSearch) {
      params.set("q", taskSearch);
    }

    const data = await apiGet<PaginatedResponse<Task>>(`/tasks?${params.toString()}`);
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
    async function fetchData() {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadTasks(false), loadProjects()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tasks");
        showToast(err instanceof Error ? err.message : "Failed to load tasks", "error");
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      void fetchData();
    }
  }, [user, selectedProjectId, taskSearch, searchSubmitted]);

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

  const handleSmartPaste = () => {
    if (!smartPasteText.trim()) {
      showToast("Paste task content first.", "error");
      return;
    }
    const parsed = parseSmartTaskPaste(smartPasteText);
    if (!parsed.title || parsed.title === "Untitled task") {
      showToast("Could not detect task structure.", "error");
      return;
    }

    setForm((current) => ({
      ...current,
      title: parsed.title,
      description: parsed.description,
      priority: parsed.priority,
      checklistText: parsed.checklistItems.join("\n"),
    }));

    showToast("Task fields auto-filled.", "success");
    setSmartPasteExpanded(false);
  };

  const createTask = async () => {
    try {
      if (!form.title.trim() || form.title === "Untitled task") {
        showToast("Task title is required.", "error");
        return;
      }
      setCreating(true);
      setError("");
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
      setCreateSheetOpen(false);
      showToast("Task created successfully.", "success");
      await loadTasks(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
      showToast(err instanceof Error ? err.message : "Failed to create task", "error");
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
  if (sessionGate) return sessionGate;
  if (!user) return null;

  return (
    <CRMShell user={user}>
      <div className="space-y-5 pb-6">
        {/* Header Action Bar */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[var(--text-main)] sm:text-xl">
              Tasks
            </h1>
            <p className="text-xs text-[var(--text-soft)]">
              {isAdminRole(user.role)
                ? "Assign, organize, and monitor workflows across all teams."
                : "Manage your assigned work and keep progress up to date."}
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FilterIcon size={14} />}
              onClick={() => setFilterOpen((prev) => !prev)}
              className="text-xs"
            >
              {filterOpen ? "Hide Filters" : "Filter"}
            </Button>

            {isAdminRole(user.role) && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<PlusIcon size={14} />}
                onClick={() => setCreateSheetOpen(true)}
                className="text-xs"
              >
                New Task
              </Button>
            )}
          </div>
        </div>

        {/* Teams Compact Status Tabs & Metric Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border)] pb-2.5">
          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { key: "ALL", label: "All", count: taskAnalytics.total },
              { key: "TODO", label: "Pending", count: taskAnalytics.todo },
              { key: "IN_PROGRESS", label: "In Progress", count: taskAnalytics.inProgress },
              { key: "DONE", label: "Completed", count: taskAnalytics.done },
            ].map((tab) => {
              const isActive = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key as any)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all shrink-0 ${
                    isActive
                      ? "bg-[var(--accent)] text-white shadow-2xs"
                      : "border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-[var(--surface-soft)] text-[var(--text-main)]"}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Metric Summary Pill */}
          <div className="flex items-center gap-2 text-xs shrink-0 self-end sm:self-center">
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-2.5 py-1 text-xs">
              <span className="font-semibold text-[var(--text-soft)]">Done:</span>
              <span className="font-bold text-emerald-600">{taskAnalytics.completionRate}%</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-2.5 py-1 text-xs">
              <span className="font-semibold text-[var(--text-soft)]">Avg:</span>
              <span className="font-bold text-[var(--accent)]">{taskAnalytics.avgProgress}%</span>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        {filterOpen && (
          <div className="flex flex-wrap gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3 shadow-xs">
            <div className="w-full sm:w-64">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-soft)] block mb-1">
                Project
              </label>
              <ResponsiveSelect
                value={selectedProjectId}
                onChange={(value) => {
                  setSelectedProjectId(value);
                  setLoading(true);
                }}
                options={projectFilterOptions}
                ariaLabel="Filter tasks by project"
                buttonClassName="h-9 rounded-lg text-xs"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-soft)] block mb-1">
                Search Tasks
              </label>
              <input
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-strong,#ffffff)] transition-all"
                value={nameFilter}
                placeholder="Search title, description, assignee..."
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Main Task List Table / Cards */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckSquareIcon size={16} className="text-blue-600" />
              <h2 className="text-sm font-semibold text-[var(--text-main)]">Task Board</h2>
            </div>
            <span className="text-xs text-[var(--text-soft)]">
              {tasksTotal ? `Showing ${visibleTasks.length} of ${tasksTotal}` : `${visibleTasks.length} tasks`}
            </span>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            ) : visibleTasks.length ? (
              <TaskList
                tasks={visibleTasks}
                user={user}
                team={teamForTaskList}
                onUpdated={() => void loadTasks(false)}
                initialIssueTaskId={initialIssueTaskId}
                initialIssueId={initialIssueId}
              />
            ) : (
              <StatePanel
                title="No tasks found"
                description={nameFilter || taskSearch ? "No tasks match your search." : "No tasks in this view yet."}
              />
            )}

            {!loading && hasMoreTasks && (
              <div className="mt-4 flex justify-center border-t border-[var(--border)] pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  loading={loadingMore}
                  onClick={() => {
                    setLoadingMore(true);
                    void loadTasks(true).finally(() => setLoadingMore(false));
                  }}
                >
                  Load More Tasks
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Slide-over Create Task Sheet */}
        <Sheet
          open={createSheetOpen}
          onClose={() => setCreateSheetOpen(false)}
          title="Create New Task"
          description="Fill in the details below to assign work to team members."
          width="lg"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCreateSheetOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={creating}
                onClick={() => void createTask()}
              >
                Create Task
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Smart Paste Toggle Accordion */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
              <button
                type="button"
                onClick={() => setSmartPasteExpanded((prev) => !prev)}
                className="flex w-full items-center justify-between text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <span>⚡ Auto-fill from text (Smart Paste)</span>
                <span>{smartPasteExpanded ? "▲ Close" : "▼ Open"}</span>
              </button>

              {smartPasteExpanded && (
                <div className="mt-3 space-y-2">
                  <textarea
                    rows={4}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-2 text-xs outline-none focus:border-blue-500"
                    placeholder="Paste formatted task, e.g.:&#10;Title: Fix auth bug&#10;Description: Resolve JWT token expiry&#10;Priority: HIGH&#10;Checklist:&#10;- Update middleware&#10;- Test login"
                    value={smartPasteText}
                    onChange={(e) => setSmartPasteText(e.target.value)}
                  />
                  <Button variant="secondary" size="xs" onClick={handleSmartPaste}>
                    Parse & Auto-fill
                  </Button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                Title *
              </label>
              <input
                className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-sm outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-strong,#ffffff)] transition-all"
                placeholder="e.g. Redesign Dashboard UI"
                value={form.title}
                onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                Description
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-strong,#ffffff)] transition-all"
                placeholder="Brief summary of requirements..."
                value={form.description}
                onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                  Priority
                </label>
                <ResponsiveSelect
                  priorityColors
                  value={form.priority}
                  onChange={(v) => setForm((c) => ({ ...c, priority: v as TaskPriority }))}
                  options={priorityOptions}
                  ariaLabel="Select task priority"
                  buttonClassName="h-9 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                  Deadline
                </label>
                <input
                  type="date"
                  className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs outline-none focus:border-blue-500 focus:bg-[var(--surface-strong,#ffffff)]"
                  value={form.deadlineAt}
                  onChange={(e) => setForm((c) => ({ ...c, deadlineAt: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)] mb-1">
                Checklist Items (one per line)
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-xs outline-none focus:border-blue-500 focus:bg-[var(--surface-strong,#ffffff)]"
                placeholder="Draft wireframes&#10;Review with team&#10;Deploy to staging"
                value={form.checklistText}
                onChange={(e) => setForm((c) => ({ ...c, checklistText: e.target.value }))}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)]">
                  Assignees
                </label>
                <span className="text-[11px] text-[var(--text-faint)]">
                  {form.userIds.length} selected
                </span>
              </div>

              <div className="mb-2">
                <MemberPickerToolbar
                  searchQuery={assignPickerQuery}
                  onSearchChange={setAssignPickerQuery}
                  roleFilter={assignPickerRole}
                  onRoleFilterChange={setAssignPickerRole}
                  roleOptions={assignPickerRoleOptions}
                />
              </div>

              <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--border)] p-2 space-y-1">
                {directory.items.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-xs hover:bg-[var(--surface-soft)]"
                  >
                    <input
                      type="checkbox"
                      checked={form.userIds.includes(m.id)}
                      onChange={() => handleAssigneeToggle(m.id)}
                    />
                    <span className="font-medium text-[var(--text-main)] truncate">{m.name}</span>
                    <span className="text-[10px] text-[var(--text-soft)]">({m.role})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Sheet>
      </div>
    </CRMShell>
  );
}

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-6 animate-pulse">
          <Skeleton className="h-10 w-48 mb-4" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      }
    >
      <TasksPageContent />
    </Suspense>
  );
}
