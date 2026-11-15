"use client";

import { MemberPickerToolbar, type MemberRoleFilter } from "@/components/shared/member-picker-toolbar";
import { TASK_PRIORITY_OPTIONS } from "@/lib/task-groups";
import { groupTasksByAssignees } from "@/lib/task-groups";
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

const COLUMNS: Array<{ key: Task["status"]; label: string; tone: string; badge: string }> = [
  { key: "TODO", label: "Pending", tone: "bg-rose-500", badge: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  { key: "IN_PROGRESS", label: "In Progress", tone: "bg-amber-500", badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  { key: "DONE", label: "Completed", tone: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
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
  return (
    <section className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-3 xl:grid xl:grid-cols-3 xl:items-start xl:overflow-visible xl:pb-0">
      {COLUMNS.map((col) => {
        const columnTasks = groupedTasks[col.key] ?? [];
        return (
          <div
            key={col.key}
            className="flex w-[86vw] sm:w-[350px] xl:w-auto shrink-0 snap-center flex-col max-h-[min(72vh,620px)] xl:max-h-[min(75vh,850px)] rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3 sm:p-4 shadow-xs"
          >
            {/* Column Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] pb-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${col.tone}`} />
                <h3 className="text-xs font-semibold tracking-wider uppercase text-[var(--text-main)]">
                  {col.label}
                </h3>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${col.badge}`}>
                {columnTasks.length}
              </span>
            </div>

            {/* Scrollable Tasks Column */}
            <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
              {groupTasksByAssignees(columnTasks).map((group) => (
                <div
                  key={group.key}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2.5 sm:p-3"
                >
                  <p className="mb-2 border-b border-[var(--border)] pb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">
                    {group.label}
                    <span className="ml-1.5 font-normal normal-case text-[var(--text-faint)]">
                      ({group.tasks.length} task{group.tasks.length === 1 ? "" : "s"})
                    </span>
                  </p>

                  <div className="space-y-2.5">
                    {group.tasks.map((task) => {
                      const done = task.checklistItems.filter((x) => x.completed).length;
                      return (
                        <article
                          key={task.id}
                          className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3 shadow-2xs transition-all hover:border-[var(--accent)]/50"
                        >
                          <div className="space-y-2.5">
                            <div className="space-y-0.5">
                              <h4 className="line-clamp-2 break-words text-sm font-semibold leading-snug text-[var(--text-main)]">
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className="line-clamp-2 break-words text-xs leading-relaxed text-[var(--text-soft)]">
                                  {task.description}
                                </p>
                              )}
                            </div>

                            <div className="grid gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onOpenEditor(task)}
                                  className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--text-soft)] hover:bg-[var(--surface-soft)] transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDelete(task.id)}
                                  className="rounded-md border border-rose-200 dark:border-rose-900/50 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>

                              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                <ResponsiveSelect
                                  priorityColors
                                  value={task.priority ?? "MEDIUM"}
                                  onChange={(value) => onPriorityChange(task.id, value as TaskPriority)}
                                  options={TASK_PRIORITY_OPTIONS.map((o) => ({
                                    value: o.value,
                                    label: o.label,
                                  }))}
                                  buttonClassName="h-8 text-xs rounded-md"
                                />
                                <select
                                  value={task.status}
                                  onChange={(e) => onStatusChange(task.id, e.target.value as Task["status"])}
                                  className="h-8 w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs font-medium text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                                  title="Change status"
                                >
                                  {COLUMNS.map((c) => (
                                    <option key={c.key} value={c.key}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Inline Edit Form */}
                          {editingTaskId === task.id ? (
                            <div className="mt-3 grid gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                              <input
                                className="h-9 rounded-md border px-2.5 text-xs outline-none focus:border-[var(--accent)]"
                                style={FIELD_STYLE}
                                value={editTaskForm.title}
                                onChange={(e) => onEditTaskFormChange("title", e.target.value)}
                                placeholder="Task title"
                              />
                              <textarea
                                className="min-h-16 rounded-md border p-2.5 text-xs outline-none focus:border-[var(--accent)]"
                                style={FIELD_STYLE}
                                value={editTaskForm.description}
                                onChange={(e) => onEditTaskFormChange("description", e.target.value)}
                                placeholder="Task description"
                              />
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <label className="grid gap-1">
                                  <span className="text-[11px] font-medium text-[var(--text-soft)]">Priority</span>
                                  <select
                                    className="h-8 w-full rounded-md border px-2 text-xs outline-none focus:border-[var(--accent)]"
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
                                </label>
                                <label className="grid gap-1">
                                  <span className="text-[11px] font-medium text-[var(--text-soft)]">Deadline</span>
                                  <input
                                    type="date"
                                    className="h-8 w-full rounded-md border px-2 text-xs outline-none focus:border-[var(--accent)]"
                                    style={FIELD_STYLE}
                                    value={editTaskForm.deadlineAt}
                                    onChange={(e) => onEditTaskFormChange("deadlineAt", e.target.value)}
                                  />
                                </label>
                              </div>
                              <textarea
                                className="min-h-16 rounded-md border p-2.5 text-xs outline-none focus:border-[var(--accent)]"
                                style={FIELD_STYLE}
                                value={editTaskForm.checklistText}
                                onChange={(e) => onEditTaskFormChange("checklistText", e.target.value)}
                                placeholder="Checklist (one item per line)"
                              />
                              <div className="grid gap-2">
                                <MemberPickerToolbar
                                  searchQuery={assignQuery}
                                  onSearchChange={onAssignQueryChange}
                                  roleFilter={assignRole}
                                  onRoleFilterChange={onAssignRoleChange}
                                  roleOptions={assignRoleOptions}
                                />
                                <div className="grid max-h-36 overflow-y-auto gap-1.5 sm:grid-cols-2">
                                  {filteredAssignees.length === 0 ? (
                                    <p className="col-span-full rounded-md border border-[var(--border)] p-2 text-xs text-[var(--text-soft)]">
                                      No members found.
                                    </p>
                                  ) : (
                                    filteredAssignees.map((m) => (
                                      <label
                                        key={m.id}
                                        className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs cursor-pointer"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={editTaskForm.userIds.includes(m.id)}
                                          onChange={() => toggleEditAssignee(m.id)}
                                          className="rounded"
                                        />
                                        <span className="truncate text-[var(--text-main)]">{m.name}</span>
                                      </label>
                                    ))
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end pt-1">
                                <button
                                  type="button"
                                  onClick={onCancelEdit}
                                  className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-soft)] hover:bg-[var(--surface)] transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={onSaveEdit}
                                  className="rounded-md bg-[var(--accent)] hover:bg-[var(--accent-strong)] px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                                >
                                  Save Task
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {/* Progress bar */}
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                            <div
                              className="h-full rounded-full bg-[var(--accent)] transition-all"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-soft)]">
                            <span>{task.progress}% complete</span>
                            <span>
                              {done}/{task.checklistItems.length} subtasks
                            </span>
                          </div>

                          {/* Assignee badges */}
                          {task.assignments.length > 0 && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {task.assignments.map((a) => (
                                <span
                                  key={a.id}
                                  className="rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-soft)]"
                                >
                                  {a.user.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}

              {columnTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--text-soft)]">
                  No tasks in this column yet.
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}
