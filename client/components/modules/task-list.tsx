"use client";

import { useEffect, useMemo, useState } from "react";
import { MemberPickerToolbar, filterMembersForPicker, sortedUniqueRoles, type MemberRoleFilter } from "@/components/shared/member-picker-toolbar";
import { apiDelete, apiPost, apiPut } from "@/lib/api";
import { getTaskAssignableRoles } from "@/lib/dashboard";
import {
  TASK_PRIORITY_OPTIONS,
  groupTasksByAssignees,
  priorityBadgeClass,
} from "@/lib/task-groups";
import type { CRMUser, Task, TaskPriority } from "@/types/crm";

type TaskListProps = {
  tasks: Task[];
  user: CRMUser;
  team?: CRMUser[];
  onUpdated?: () => Promise<void> | void;
  initialIssueTaskId?: string | null;
  initialIssueId?: string | null;
};

const statuses: Array<Task["status"]> = ["TODO", "IN_PROGRESS", "DONE"];

const statusStyles: Record<Task["status"], string> = {
  TODO: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200",
  DONE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
};

export function TaskList({
  tasks,
  user,
  team = [],
  onUpdated,
  initialIssueTaskId = null,
  initialIssueId = null,
}: TaskListProps) {
  const [now, setNow] = useState(() => Date.now());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [issueDrafts, setIssueDrafts] = useState<
    Record<string, { title: string; description: string }>
  >({});
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<
    Record<
      string,
      { title: string; description: string; userIds: string[]; checklistText: string; priority: TaskPriority; deadlineAt: string }
    >
  >({});
  const [issuePanelTaskId, setIssuePanelTaskId] = useState<string | null>(null);
  const [checklistPanelTaskId, setChecklistPanelTaskId] = useState<string | null>(null);
  const [highlightedIssueId, setHighlightedIssueId] = useState<string | null>(null);
  const [responsePreviewIssue, setResponsePreviewIssue] = useState<{
    taskTitle: string;
    issueTitle: string;
    response: string;
  } | null>(null);
  const [assigneePickQuery, setAssigneePickQuery] = useState("");
  const [assigneePickRole, setAssigneePickRole] = useState<MemberRoleFilter>("ALL");

  useEffect(() => {
    if (!initialIssueTaskId) {
      return;
    }

    const task = tasks.find((item) => item.id === initialIssueTaskId);
    if (!task) {
      return;
    }

    setIssuePanelTaskId(task.id);

    if (initialIssueId && task.issues.some((issue) => issue.id === initialIssueId)) {
      setHighlightedIssueId(initialIssueId);
      const matched = task.issues.find((issue) => issue.id === initialIssueId);
      if (matched?.managerResponse) {
        setResponsePreviewIssue({
          taskTitle: task.title,
          issueTitle: matched.title,
          response: matched.managerResponse,
        });
      }
    }
  }, [initialIssueTaskId, initialIssueId, tasks]);

  const canManageTask = (task: Task) =>
    user.role === "SUPERADMIN" ||
    user.role === "ADMIN" ||
    user.role === "MANAGER" ||
    task.assignments.some((assignment) => assignment.userId === user.id);

  const canReportIssue = (task: Task) =>
    user.role === "SUPERADMIN" ||
    user.role === "ADMIN" ||
    user.role === "MANAGER" ||
    task.assignments.some((assignment) => assignment.userId === user.id);

  const canRespondToIssues =
    user.role === "SUPERADMIN" || user.role === "ADMIN" || user.role === "MANAGER";
  const canEditTask = canRespondToIssues;
  const assignableRoles = getTaskAssignableRoles(user.role);
  const assigneeRoleOptions = useMemo(() => {
    const pool = team.filter((member) => assignableRoles.includes(member.role));
    return sortedUniqueRoles(pool);
  }, [team, assignableRoles]);
  const filteredAssignees = useMemo(
    () =>
      filterMembersForPicker(team, {
        searchQuery: assigneePickQuery,
        roleFilter: assigneePickRole,
        restrictToRoles: assignableRoles,
      }),
    [team, assigneePickQuery, assigneePickRole, assignableRoles]
  );

  const taskGroups = useMemo(() => groupTasksByAssignees(tasks), [tasks]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const toLocalDateTimeInput = (value?: string | null) => {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  const getCountdownLabel = (deadlineAt?: string | null) => {
    if (!deadlineAt) {
      return null;
    }
    const deadline = new Date(deadlineAt).getTime();
    if (Number.isNaN(deadline)) {
      return null;
    }
    const diff = deadline - now;
    const abs = Math.abs(diff);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    const minutes = Math.floor((abs % 3600000) / 60000);
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours || days) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return `${diff >= 0 ? "Time left" : "Overdue by"} ${parts.join(" ")}`;
  };

  const openEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditForms((current) => ({
      ...current,
      [task.id]: {
        title: task.title,
        description: task.description ?? "",
        userIds: task.assignments.map((assignment) => assignment.userId),
        checklistText: task.checklistItems.map((item) => item.title).join("\n"),
        priority: task.priority ?? "MEDIUM",
        deadlineAt: toLocalDateTimeInput(task.deadlineAt),
      },
    }));
  };

  const toggleIssuePanel = (taskId: string) => {
    setIssuePanelTaskId((current) => (current === taskId ? null : taskId));
  };

  const toggleChecklistPanel = (taskId: string) => {
    setChecklistPanelTaskId((current) => (current === taskId ? null : taskId));
  };

  const handleTaskUpdate = async (
    taskId: string,
    payload: Partial<Pick<Task, "status" | "progress" | "priority">>
  ) => {
    try {
      setSavingId(taskId);
      await apiPut(`/tasks/${taskId}`, payload);
      await onUpdated?.();
    } finally {
      setSavingId(null);
    }
  };

  const handleChecklistToggle = async (itemId: string, taskId: string) => {
    try {
      setSavingId(taskId);
      await apiPut(`/tasks/checklist/${itemId}`);
      await onUpdated?.();
    } finally {
      setSavingId(null);
    }
  };

  const handleIssueSubmit = async (taskId: string) => {
    const draft = issueDrafts[taskId];

    if (!draft?.title || !draft?.description) {
      return;
    }

    try {
      setSavingId(taskId);
      await apiPost(`/tasks/${taskId}/issues`, draft);
      setIssueDrafts((current) => ({
        ...current,
        [taskId]: { title: "", description: "" },
      }));
      await onUpdated?.();
    } finally {
      setSavingId(null);
    }
  };

  const handleIssueResponse = async (issueId: string, taskId: string) => {
    const managerResponse = responseDrafts[issueId];

    if (!managerResponse) {
      return;
    }

    try {
      setSavingId(taskId);
      await apiPut(`/tasks/issues/${issueId}/respond`, { managerResponse });
      setResponseDrafts((current) => ({
        ...current,
        [issueId]: "",
      }));
      await onUpdated?.();
    } finally {
      setSavingId(null);
    }
  };

  const handleEditAssigneeToggle = (taskId: string, userId: string) => {
    setEditForms((current) => {
      const form = current[taskId];
      if (!form) {
        return current;
      }

      return {
        ...current,
        [taskId]: {
          ...form,
          userIds: form.userIds.includes(userId)
            ? form.userIds.filter((id) => id !== userId)
            : [...form.userIds, userId],
        },
      };
    });
  };

  const saveTaskEdits = async (taskId: string) => {
    const form = editForms[taskId];
    if (!form) {
      return;
    }

    try {
      setSavingId(taskId);
      await apiPut(`/tasks/${taskId}`, {
        title: form.title,
        description: form.description,
        userIds: form.userIds,
        priority: form.priority,
        deadlineAt: form.deadlineAt || null,
        checklistItems: form.checklistText
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setEditingTaskId(null);
      await onUpdated?.();
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const shouldDelete = window.confirm("Delete this task permanently?");
    if (!shouldDelete) {
      return;
    }

    try {
      setSavingId(taskId);
      await apiDelete(`/tasks/${taskId}`);
      if (editingTaskId === taskId) {
        setEditingTaskId(null);
      }
      await onUpdated?.();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {taskGroups.map((group) => (
        <section
          key={group.key}
          className="rounded-xl border p-4"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <div
            className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3"
            style={{ borderColor: "var(--border)" }}
          >
            <p className="text-sm font-semibold text-[var(--text-main)]">{group.label}</p>
            <p className="text-xs text-[var(--text-soft)]">
              {group.tasks.length} task{group.tasks.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="space-y-3">
            {group.tasks.map((task) => {
              const showAssigneeChips = !group.key.startsWith("user:");
              const showInlineStatusSelect = canManageTask(task) && !task.checklistItems.length;
              const showPrioritySelect = canManageTask(task);
              const shouldShowTimer =
                task.assignments.some((assignment) => assignment.userId === user.id) ||
                task.assignedById === user.id;
              const countdownLabel = shouldShowTimer ? getCountdownLabel(task.deadlineAt) : null;
              return (
              <article
                key={task.id}
                className="rounded-lg border p-3 sm:p-4"
                style={{
                  background: "var(--surface-soft)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
                        <h3 className="line-clamp-2 min-w-0 flex-1 text-base font-semibold leading-snug text-[var(--text-main)]">
                          {task.title}
                        </h3>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {!showPrioritySelect ? (
                          <span
                            className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${priorityBadgeClass[task.priority ?? "MEDIUM"]}`}
                          >
                            {TASK_PRIORITY_OPTIONS.find((o) => o.value === (task.priority ?? "MEDIUM"))?.label ??
                              "Medium"}
                          </span>
                        ) : null}
                        {!showInlineStatusSelect ? (
                          <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${statusStyles[task.status]}`}>
                            {task.status.replace("_", " ")}
                          </span>
                        ) : null}
                        {showPrioritySelect ? (
                          <select
                            value={task.priority ?? "MEDIUM"}
                            disabled={savingId === task.id}
                            onChange={(event) =>
                              void handleTaskUpdate(task.id, {
                                priority: event.target.value as TaskPriority,
                              })
                            }
                            className="rounded-md border px-2 py-1 text-xs outline-none"
                            style={{
                              borderColor: "var(--border)",
                              background: "var(--surface)",
                              color: "var(--text-main)",
                            }}
                            title="Priority"
                          >
                            {TASK_PRIORITY_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {showInlineStatusSelect ? (
                          <select
                            value={task.status}
                            disabled={savingId === task.id}
                            onChange={(event) =>
                              void handleTaskUpdate(task.id, {
                                status: event.target.value as Task["status"],
                              })
                            }
                            className="rounded-md border px-2 py-1 text-xs outline-none"
                            style={{
                              borderColor: "var(--border)",
                              background: "var(--surface)",
                              color: "var(--text-main)",
                            }}
                          >
                            {statuses.map((status) => (
                              <option key={status} value={status}>
                                {status.replace("_", " ")}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        </div>
                      </div>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-soft)]">{task.description || "No description"}</p>
                {task.deadlineAt ? (
                  <p className="mt-1 text-xs text-[var(--text-soft)]">
                    Deadline: {new Date(task.deadlineAt).toLocaleString()}
                  </p>
                ) : null}
                {countdownLabel ? (
                  <p className="mt-1 text-xs font-semibold text-[var(--accent-strong)]">{countdownLabel}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {task.issues.some((issue) => Boolean(issue.managerResponse)) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIssuePanelTaskId(task.id);
                      const latestRespondedIssue = task.issues.find((issue) => issue.managerResponse);
                      if (latestRespondedIssue) {
                        setHighlightedIssueId(latestRespondedIssue.id);
                        setResponsePreviewIssue({
                          taskTitle: task.title,
                          issueTitle: latestRespondedIssue.title,
                          response: latestRespondedIssue.managerResponse ?? "",
                        });
                      }
                    }}
                    className="rounded-md border px-2.5 py-1 text-xs font-semibold"
                    style={{ borderColor: "var(--border)", color: "var(--accent-strong)" }}
                  >
                    Responses ({task.issues.filter((issue) => Boolean(issue.managerResponse)).length})
                  </button>
                ) : null}
                {canEditTask ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openEditTask(task)}
                      className="rounded-md border px-2.5 py-1 text-xs font-semibold"
                      style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteTask(task.id)}
                      disabled={savingId === task.id}
                      className="rounded-md border px-2.5 py-1 text-xs font-semibold text-rose-600 disabled:opacity-60"
                      style={{ borderColor: "var(--border)" }}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => toggleIssuePanel(task.id)}
                  className="rounded-md border px-2.5 py-1 text-xs font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
                >
                  {issuePanelTaskId === task.id ? "Minimize Issues" : `Issues (${task.issues.length})`}
                </button>
              </div>
            </div>

            <div className="max-w-xl">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold text-[var(--text-soft)]">Progress</p>
                <span className="text-xs font-semibold text-[var(--text-main)]">{task.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--surface-soft)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, var(--accent-strong), var(--success))",
                    width: `${task.progress}%`,
                  }}
                />
              </div>
              {canManageTask(task) && !task.checklistItems.length ? (
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={task.progress}
                  disabled={savingId === task.id}
                  onChange={(event) =>
                    void handleTaskUpdate(task.id, {
                      progress: Number(event.target.value),
                    })
                  }
                  className="mt-2 w-full accent-slate-950"
                />
              ) : null}
            </div>

            {showAssigneeChips ? (
            <div className="flex flex-wrap items-center gap-2">
              {task.assignments.slice(0, 3).map((assignment) => (
                <span
                  key={assignment.id}
                  className="rounded-md border px-2 py-1 text-[11px] font-medium"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface-soft)",
                    color: "var(--text-soft)",
                  }}
                >
                  {assignment.user.name}
                </span>
              ))}
              {task.assignments.length > 3 ? (
                <span className="text-xs text-[var(--text-faint)]">+{task.assignments.length - 3} more</span>
              ) : null}
            </div>
            ) : null}
          </div>

          {editingTaskId === task.id ? (
            <div
              className="mt-4 grid gap-3 rounded-lg border p-4"
              style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
            >
              <input
                className="h-11 rounded-md border px-3 text-sm outline-none"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
                value={editForms[task.id]?.title ?? ""}
                onChange={(event) =>
                  setEditForms((current) => ({
                    ...current,
                    [task.id]: {
                      ...(current[task.id] ?? {
                        title: "",
                        description: "",
                        userIds: [],
                        checklistText: "",
                        priority: "MEDIUM" as TaskPriority,
                        deadlineAt: "",
                      }),
                      title: event.target.value,
                    },
                  }))
                }
              />
              <textarea
                className="min-h-24 rounded-md border px-3 py-3 text-sm outline-none"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
                value={editForms[task.id]?.description ?? ""}
                onChange={(event) =>
                  setEditForms((current) => ({
                    ...current,
                    [task.id]: {
                      ...(current[task.id] ?? {
                        title: "",
                        description: "",
                        userIds: [],
                        checklistText: "",
                        priority: "MEDIUM" as TaskPriority,
                        deadlineAt: "",
                      }),
                      description: event.target.value,
                    },
                  }))
                }
              />
              {canEditTask ? (
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[var(--text-soft)]">Priority</span>
                  <select
                    className="h-11 rounded-md border px-3 text-sm outline-none"
                    style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
                    value={editForms[task.id]?.priority ?? "MEDIUM"}
                    onChange={(event) =>
                      setEditForms((current) => ({
                        ...current,
                        [task.id]: {
                          ...(current[task.id] ?? {
                            title: "",
                            description: "",
                            userIds: [],
                          checklistText: "",
                          priority: "MEDIUM" as TaskPriority,
                          deadlineAt: "",
                        }),
                          priority: event.target.value as TaskPriority,
                        },
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
              ) : null}
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-[var(--text-soft)]">Deadline</span>
                <input
                  type="datetime-local"
                  className="h-11 rounded-md border px-3 text-sm outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
                  value={editForms[task.id]?.deadlineAt ?? ""}
                  onChange={(event) =>
                    setEditForms((current) => ({
                      ...current,
                      [task.id]: {
                        ...(current[task.id] ?? {
                          title: "",
                          description: "",
                          userIds: [],
                          checklistText: "",
                          priority: "MEDIUM" as TaskPriority,
                          deadlineAt: "",
                        }),
                        deadlineAt: event.target.value,
                      },
                    }))
                  }
                />
              </label>
              <textarea
                className="min-h-24 rounded-md border px-3 py-3 text-sm outline-none"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
                value={editForms[task.id]?.checklistText ?? ""}
                placeholder="Checklist items, one per line"
                onChange={(event) =>
                  setEditForms((current) => ({
                    ...current,
                    [task.id]: {
                      ...(current[task.id] ?? {
                        title: "",
                        description: "",
                        userIds: [],
                        checklistText: "",
                        priority: "MEDIUM" as TaskPriority,
                        deadlineAt: "",
                      }),
                      checklistText: event.target.value,
                    },
                  }))
                }
              />
              {team.length ? (
                <div className="grid gap-2">
                  <MemberPickerToolbar
                    searchQuery={assigneePickQuery}
                    onSearchChange={setAssigneePickQuery}
                    roleFilter={assigneePickRole}
                    onRoleFilterChange={setAssigneePickRole}
                    roleOptions={assigneeRoleOptions}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredAssignees.length === 0 ? (
                      <p className="col-span-full rounded-md border px-3 py-4 text-sm text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>
                        No matches. Adjust search or role filter.
                      </p>
                    ) : (
                      filteredAssignees.map((member) => (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
                        >
                          <input
                            type="checkbox"
                            checked={editForms[task.id]?.userIds.includes(member.id) ?? false}
                            onChange={() => handleEditAssigneeToggle(task.id, member.id)}
                          />
                          <span>{member.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={savingId === task.id}
                  onClick={() => void saveTaskEdits(task.id)}
                  className="crm-gradient-button rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTaskId(null)}
                  className="rounded-md border px-4 py-2 text-sm font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {task.checklistItems.length ? (
            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-[var(--text-soft)]">Checklist</p>
                <button
                  type="button"
                  onClick={() => toggleChecklistPanel(task.id)}
                  className="rounded-md border px-2.5 py-1 text-[11px] font-semibold"
                  style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
                >
                  {checklistPanelTaskId === task.id ? "Minimize" : "Open"}
                </button>
              </div>
              {checklistPanelTaskId === task.id ? (
                <div className="mt-2 space-y-2">
                  {task.checklistItems.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--surface-soft)",
                        color: "var(--text-main)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        disabled={savingId === task.id}
                        onChange={() => void handleChecklistToggle(item.id, task.id)}
                      />
                      <span className={item.completed ? "line-through opacity-60" : ""}>{item.title}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {issuePanelTaskId === task.id ? (
            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <div className="space-y-3">
              {task.issues.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-lg border p-4"
                  style={{
                    borderColor:
                      highlightedIssueId === issue.id ? "var(--accent-strong)" : "var(--border)",
                    background: "var(--surface-soft)",
                    boxShadow:
                      highlightedIssueId === issue.id
                        ? "0 0 0 1px color-mix(in srgb, var(--accent-strong) 45%, transparent)"
                        : undefined,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--text-main)]">{issue.title}</p>
                      <p className="mt-1 text-sm text-[var(--text-soft)]">{issue.description}</p>
                      <p className="mt-2 text-xs text-[var(--text-soft)]">
                        Reported by {issue.reporter.name} - {issue.status}
                      </p>
                    </div>
                  </div>

                  {issue.managerResponse ? (
                    <div className="mt-3 rounded-xl p-3 text-sm" style={{ background: "var(--surface)" }}>
                      <p className="font-semibold text-[var(--text-main)]">Manager response</p>
                      <p className="mt-1 text-[var(--text-soft)]">{issue.managerResponse}</p>
                      <button
                        type="button"
                        className="mt-3 rounded-md border px-3 py-1.5 text-xs font-semibold"
                        style={{ borderColor: "var(--border)", color: "var(--accent-strong)" }}
                        onClick={() =>
                          setResponsePreviewIssue({
                            taskTitle: task.title,
                            issueTitle: issue.title,
                            response: issue.managerResponse ?? "",
                          })
                        }
                      >
                        Open response
                      </button>
                    </div>
                  ) : canRespondToIssues ? (
                    <div className="mt-3 space-y-3">
                      <textarea
                        className="min-h-24 w-full rounded-md border px-3 py-3 text-sm outline-none"
                        style={{
                          borderColor: "var(--border)",
                          background: "var(--surface)",
                          color: "var(--text-main)",
                        }}
                        placeholder="Add guidance, help, or an alternative solution"
                        value={responseDrafts[issue.id] ?? ""}
                        onChange={(event) =>
                          setResponseDrafts((current) => ({
                            ...current,
                            [issue.id]: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        disabled={savingId === task.id}
                        onClick={() => void handleIssueResponse(issue.id, task.id)}
                        className="crm-gradient-button rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-70"
                      >
                        Send response
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {canReportIssue(task) ? (
              <div
                className="mt-4 grid gap-3 rounded-lg border border-dashed p-4"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <input
                  className="h-11 rounded-md border px-3 text-sm outline-none"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface-soft)",
                    color: "var(--text-main)",
                  }}
                  placeholder="Issue title"
                  value={issueDrafts[task.id]?.title ?? ""}
                  onChange={(event) =>
                    setIssueDrafts((current) => ({
                      ...current,
                      [task.id]: {
                        title: event.target.value,
                        description: current[task.id]?.description ?? "",
                      },
                    }))
                  }
                />
                <textarea
                  className="min-h-24 rounded-md border px-3 py-3 text-sm outline-none"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface-soft)",
                    color: "var(--text-main)",
                  }}
                  placeholder="Describe the blocker so your manager can help"
                  value={issueDrafts[task.id]?.description ?? ""}
                  onChange={(event) =>
                    setIssueDrafts((current) => ({
                      ...current,
                      [task.id]: {
                        title: current[task.id]?.title ?? "",
                        description: event.target.value,
                      },
                    }))
                  }
                />
                <button
                  type="button"
                  disabled={savingId === task.id}
                  onClick={() => void handleIssueSubmit(task.id)}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-70"
                  style={{ background: "var(--danger)" }}
                >
                  Report issue
                </button>
              </div>
            ) : null}
            </div>
          ) : null}
        </article>
              );
            })}
          </div>
        </section>
      ))}
      {responsePreviewIssue ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div
            className="w-full max-w-lg rounded-xl border p-5"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">Issue response</p>
            <h4 className="mt-2 text-lg font-semibold text-[var(--text-main)]">{responsePreviewIssue.issueTitle}</h4>
            <p className="mt-1 text-xs text-[var(--text-soft)]">Task: {responsePreviewIssue.taskTitle}</p>
            <div className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <p className="text-[var(--text-main)]">{responsePreviewIssue.response}</p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setResponsePreviewIssue(null)}
                className="rounded-md border px-4 py-2 text-sm font-semibold"
                style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
              >
                Minimize
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
