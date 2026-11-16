"use client";

import { useState } from "react";
import { MemberPickerToolbar, type MemberRoleFilter } from "@/components/shared/member-picker-toolbar";
import { TASK_PRIORITY_OPTIONS } from "@/lib/task-groups";
import { ResponsiveSelect } from "../shared/responsive-select";
import type { CRMUser, Task, TaskPriority, UserRole } from "@/types/crm";

type TaskFormState = {
  title: string;
  description: string;
  userIds: string[];
  checklistText: string;
  priority: TaskPriority;
  deadlineAt: string;
};

const COLUMNS: Array<{ key: Task["status"]; label: string; tone: string; badge: string; border: string }> = [
  { key: "TODO", label: "Pending", tone: "bg-amber-500", badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", border: "border-amber-500/20" },
  { key: "IN_PROGRESS", label: "In Progress", tone: "bg-blue-500", badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300", border: "border-blue-500/20" },
  { key: "DONE", label: "Completed", tone: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", border: "border-emerald-500/20" },
];

const FIELD_STYLE = {
  borderColor: "var(--border)",
  background: "var(--surface)",
  color: "var(--text-main)",
} as const;

type Props = {
  groupedTasks: Record<Task["status"], Task[]>;
  editingTaskId: string;
  editTaskForm: TaskFormState;
  filteredAssignees: CRMUser[];
  assignQuery: string;
  onAssignQueryChange: (q: string) => void;
  assignRole: MemberRoleFilter;
  onAssignRoleChange: (r: MemberRoleFilter) => void;
  assignRoleOptions: UserRole[];
  onEditTaskFormChange: (field: keyof TaskFormState, value: string | string[]) => void;
  onOpenEditor: (task: Task) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: Task["status"]) => void;
  onPriorityChange: (taskId: string, priority: TaskPriority) => void;
  toggleEditAssignee: (userId: string) => void;
};

export function TaskKanban({
  groupedTasks,
  editingTaskId,
  editTaskForm,
  filteredAssignees,
  assignQuery,
  onAssignQueryChange,
  assignRole,
  onAssignRoleChange,
  assignRoleOptions,
  onEditTaskFormChange,
  onOpenEditor,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onStatusChange,
  onPriorityChange,
  toggleEditAssignee,
}: Props) {
  const [mobileColumnFilter, setMobileColumnFilter] = useState<Task["status"] | "ALL">("ALL");

  const visibleColumns = COLUMNS.filter((col) => {
    if (mobileColumnFilter === "ALL") return true;
    return col.key === mobileColumnFilter;
  });

  return (
    <div className="space-y-3">
      {/* Mobile Column Quick-Filter Tabs */}
      <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setMobileColumnFilter("ALL")}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            mobileColumnFilter === "ALL"
              ? "bg-[var(--accent)] text-white shadow-xs"
              : "border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
          }`}
        >
          All Columns
        </button>
        {COLUMNS.map((col) => {
          const count = groupedTasks[col.key]?.length ?? 0;
          const isActive = mobileColumnFilter === col.key;
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => setMobileColumnFilter(col.key)}
              className={`shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-[var(--accent)] text-white shadow-xs"
                  : "border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${col.tone}`} />
              <span>{col.label}</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${isActive ? "bg-white/20 text-white" : col.badge}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Board Grid */}
      <section
        className={`flex overflow-x-auto snap-x snap-mandatory gap-3 pb-3 ${
          mobileColumnFilter === "ALL"
            ? "lg:grid lg:grid-cols-3 lg:items-start lg:overflow-visible lg:pb-0"
            : "w-full"
        }`}
      >
        {visibleColumns.map((col) => {
          const columnTasks = groupedTasks[col.key] ?? [];
          return (
            <div
              key={col.key}
              className={`flex shrink-0 snap-center flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3 shadow-xs ${
                mobileColumnFilter === "ALL"
                  ? "w-[85vw] max-w-[340px] sm:w-[320px] lg:w-auto max-h-[min(70vh,600px)] lg:max-h-[min(75vh,800px)]"
                  : "w-full min-h-[300px]"
              }`}
            >
              {/* Column Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.tone}`} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
                    {col.label}
                  </h3>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${col.badge}`}>
                  {columnTasks.length}
                </span>
              </div>

              {/* Scrollable Tasks Column */}
              <div className="mt-2.5 min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain pr-0.5">
                {columnTasks.map((task) => {
                  const doneSubtasks = task.checklistItems.filter((x) => x.completed).length;
                  const totalSubtasks = task.checklistItems.length;
                  const isEditing = editingTaskId === task.id;

                  return (
                    <article
                      key={task.id}
                      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 shadow-2xs transition-all hover:border-[var(--accent)]/40 hover:shadow-xs"
                    >
                      <div className="space-y-2">
                        {/* Title and Priority Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-semibold leading-snug text-[var(--text-main)] break-words">
                            {task.title}
                          </h4>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              task.priority === "URGENT"
                                ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                                : task.priority === "HIGH"
                                ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {task.priority ?? "MEDIUM"}
                          </span>
                        </div>

                        {task.description && (
                          <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--text-soft)]">
                            {task.description}
                          </p>
                        )}

                        {/* Progress & Subtasks */}
                        {totalSubtasks > 0 && (
                          <div className="space-y-1">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                              <div
                                className="h-full rounded-full bg-[var(--accent)] transition-all"
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-[var(--text-faint)]">
                              <span>{task.progress}% complete</span>
                              <span>
                                {doneSubtasks}/{totalSubtasks} subtasks
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Assignees & Status Selector */}
                        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[var(--border)]">
                          {/* Assignees */}
                          <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                            {task.assignments.length > 0 ? (
                              task.assignments.slice(0, 2).map((a) => (
                                <span
                                  key={a.id}
                                  className="truncate rounded bg-[var(--surface-strong,#ffffff)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-soft)]"
                                  title={a.user.name}
                                >
                                  {a.user.name.split(" ")[0]}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-[var(--text-faint)]">Unassigned</span>
                            )}
                            {task.assignments.length > 2 && (
                              <span className="text-[10px] text-[var(--text-faint)]">
                                +{task.assignments.length - 2}
                              </span>
                            )}
                          </div>

                          {/* Action controls */}
                          <div className="flex items-center gap-1 shrink-0">
                            <select
                              value={task.status}
                              onChange={(e) => onStatusChange(task.id, e.target.value as Task["status"])}
                              className="h-7 rounded border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-1.5 text-[10px] font-medium text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                              title="Move task"
                            >
                              {COLUMNS.map((c) => (
                                <option key={c.key} value={c.key}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => onOpenEditor(task)}
                              className="h-7 rounded border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-2 text-[10px] font-semibold text-[var(--text-soft)] hover:text-[var(--text-main)] transition-colors"
                              title="Edit task"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(task.id)}
                              className="h-7 rounded border border-rose-200 dark:border-rose-900/40 bg-[var(--surface-strong,#ffffff)] px-1.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete task"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Inline Edit Form */}
                      {isEditing && (
                        <div className="mt-3 grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-2.5 animate-in fade-in duration-100">
                          <input
                            className="h-8 rounded-md border px-2 text-xs outline-none focus:border-[var(--accent)]"
                            style={FIELD_STYLE}
                            value={editTaskForm.title}
                            onChange={(e) => onEditTaskFormChange("title", e.target.value)}
                            placeholder="Task title"
                          />
                          <textarea
                            rows={2}
                            className="rounded-md border p-2 text-xs outline-none focus:border-[var(--accent)]"
                            style={FIELD_STYLE}
                            value={editTaskForm.description}
                            onChange={(e) => onEditTaskFormChange("description", e.target.value)}
                            placeholder="Task description"
                          />
                          <div className="grid grid-cols-2 gap-1.5">
                            <select
                              className="h-7 w-full rounded-md border px-1.5 text-[11px] outline-none"
                              style={FIELD_STYLE}
                              value={editTaskForm.priority}
                              onChange={(e) => onEditTaskFormChange("priority", e.target.value)}
                            >
                              {TASK_PRIORITY_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="date"
                              className="h-7 w-full rounded-md border px-1.5 text-[11px] outline-none"
                              style={FIELD_STYLE}
                              value={editTaskForm.deadlineAt}
                              onChange={(e) => onEditTaskFormChange("deadlineAt", e.target.value)}
                            />
                          </div>

                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              type="button"
                              onClick={onCancelEdit}
                              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-soft)]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={onSaveEdit}
                              className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-white"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}

                {columnTasks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--text-soft)]">
                    No tasks in this column.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
