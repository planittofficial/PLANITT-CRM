"use client";

import { useEffect, useRef, useState } from "react";
import { MemberPickerToolbar, type MemberRoleFilter } from "@/components/shared/member-picker-toolbar";
import { TASK_PRIORITY_OPTIONS } from "@/lib/task-groups";
import type { CRMUser, Task, TaskPriority, UserRole } from "@/types/crm";

type TaskFormState = {
  title: string;
  description: string;
  userIds: string[];
  checklistText: string;
  priority: TaskPriority;
  deadlineAt: string;
};

const COLUMNS: Array<{ key: Task["status"]; label: string; tone: string; badge: string; border: string; icon: string }> = [
  { key: "TODO", label: "Pending", tone: "bg-amber-500", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30", border: "border-l-amber-500", icon: "⏳" },
  { key: "IN_PROGRESS", label: "In Progress", tone: "bg-blue-500", badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30", border: "border-l-blue-500", icon: "⚡" },
  { key: "DONE", label: "Completed", tone: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30", border: "border-l-emerald-500", icon: "✅" },
];

const FIELD_STYLE = {
  borderColor: "var(--border)",
  background: "var(--surface)",
  color: "var(--text-main)",
} as const;

function formatDueDate(isoDate?: string | null) {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  const isPast = date.getTime() < now.getTime() - 24 * 60 * 60 * 1000;
  const isToday = date.toDateString() === now.toDateString();
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { label, isPast, isToday };
}

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
  onQuickCreate?: (title: string, status: Task["status"]) => Promise<void> | void;
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
  onQuickCreate,
}: Props) {
  // Mobile defaults to the first column with tasks, or "TODO" for a clean single-column view
  const [mobileColumnFilter, setMobileColumnFilter] = useState<Task["status"] | "ALL">("TODO");
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);
  const [addingCol, setAddingCol] = useState<Task["status"] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close open ... menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuTaskId(null);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  const handleQuickAdd = async (status: Task["status"]) => {
    if (!newTitle.trim() || !onQuickCreate) return;
    try {
      setIsSubmittingQuick(true);
      await onQuickCreate(newTitle.trim(), status);
      setNewTitle("");
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  const visibleColumns = COLUMNS.filter((col) => {
    if (mobileColumnFilter === "ALL") return true;
    return col.key === mobileColumnFilter;
  });

  return (
    <div className="space-y-3">
      {/* ── MOBILE INTERACTIVE COLUMN SWITCHER ─────────────────────────────── */}
      <div className="flex sm:hidden items-center justify-between gap-1 p-1 rounded-xl bg-[var(--surface-soft)] border border-[var(--border)]">
        {COLUMNS.map((col) => {
          const count = groupedTasks[col.key]?.length ?? 0;
          const isActive = mobileColumnFilter === col.key;
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => setMobileColumnFilter(col.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? "bg-[var(--surface-strong,#ffffff)] text-[var(--text-main)] shadow-2xs border border-[var(--border)]"
                  : "text-[var(--text-soft)] hover:text-[var(--text-main)]"
              }`}
            >
              <span className="text-[11px]">{col.icon}</span>
              <span className="truncate">{col.label}</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${isActive ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-hover)] text-[var(--text-soft)]"}`}>
                {count}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileColumnFilter(mobileColumnFilter === "ALL" ? "TODO" : "ALL")}
          className={`px-2 py-1.5 text-xs font-bold rounded-lg transition-all ${
            mobileColumnFilter === "ALL"
              ? "bg-[var(--accent)] text-white shadow-2xs"
              : "text-[var(--text-soft)] hover:text-[var(--text-main)]"
          }`}
          title="Toggle All Columns view"
        >
          All
        </button>
      </div>

      {/* ── KANBAN BOARD GRID ──────────────────────────────────────────────── */}
      <section
        className={`flex overflow-x-auto snap-x snap-mandatory gap-3.5 pb-3 ${
          mobileColumnFilter === "ALL"
            ? "lg:grid lg:grid-cols-3 lg:items-start lg:overflow-visible lg:pb-0"
            : "w-full lg:grid lg:grid-cols-3 lg:items-start lg:overflow-visible lg:pb-0"
        }`}
      >
        {(mobileColumnFilter === "ALL" ? COLUMNS : visibleColumns).map((col) => {
          const columnTasks = groupedTasks[col.key] ?? [];
          return (
            <div
              key={col.key}
              className={`flex shrink-0 snap-center flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3.5 shadow-xs transition-all ${
                mobileColumnFilter === "ALL"
                  ? "w-[85vw] max-w-[340px] sm:w-[320px] lg:w-auto max-h-[min(70vh,600px)] lg:max-h-[min(75vh,800px)]"
                  : "w-full max-h-[min(75vh,700px)] lg:max-h-[min(75vh,800px)]"
              }`}
            >
              {/* Column Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.tone} ring-2 ring-[var(--surface-soft)] shadow-2xs`} />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-main)]">
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
                  const dueDate = formatDueDate(task.deadlineAt);
                  const isMenuOpen = openMenuTaskId === task.id;
                  const isDone = task.status === "DONE";

                  return (
                    <article
                      key={task.id}
                      className={`group relative overflow-visible rounded-xl border border-[var(--border)] p-3 shadow-2xs transition-all hover:border-[var(--accent)] hover:shadow-xs active:scale-[0.99] ${
                        isDone
                          ? "bg-emerald-500/5 border-emerald-500/25 border-l-4 border-l-emerald-500"
                          : task.priority === "URGENT"
                          ? "bg-[var(--surface-soft)] border-l-4 border-l-rose-500"
                          : task.priority === "HIGH"
                          ? "bg-[var(--surface-soft)] border-l-4 border-l-amber-500"
                          : task.status === "IN_PROGRESS"
                          ? "bg-[var(--surface-soft)] border-l-4 border-l-blue-500"
                          : "bg-[var(--surface-soft)] border-l-4 border-l-slate-300 dark:border-l-slate-700"
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Title Row with Completion Ring & Action Dropdown */}
                        <div className="flex items-start gap-2.5">
                          {/* Quick Toggle Status */}
                          <button
                            type="button"
                            onClick={() => onStatusChange(task.id, isDone ? "TODO" : "DONE")}
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all ${
                              isDone
                                ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                                : task.status === "IN_PROGRESS"
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 ring-2 ring-blue-500/20"
                                : "border-[var(--border-strong)] hover:border-[var(--accent)] hover:scale-105"
                            }`}
                            title={isDone ? "Mark as pending" : "Mark as completed"}
                          >
                            {isDone && <span className="text-[10px] font-black leading-none">✓</span>}
                            {task.status === "IN_PROGRESS" && (
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            )}
                          </button>

                          {/* Task Title (Click opens details) */}
                          <h4
                            onClick={() => onOpenEditor(task)}
                            className={`flex-1 text-xs font-semibold leading-snug break-words cursor-pointer transition-colors hover:text-[var(--accent)] ${
                              isDone ? "line-through text-[var(--text-faint)]" : "text-[var(--text-main)]"
                            }`}
                          >
                            {task.title}
                          </h4>

                          {/* Discreet Overflow Actions '...' Button */}
                          <div className="relative shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuTaskId(isMenuOpen ? null : task.id);
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-transparent text-[var(--text-soft)] hover:border-[var(--border)] hover:bg-[var(--surface-strong,#ffffff)] hover:text-[var(--text-main)] transition-colors"
                              title="Task options"
                            >
                              •••
                            </button>

                            {/* Flyout Menu */}
                            {isMenuOpen && (
                              <div
                                ref={menuRef}
                                className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-1 shadow-xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuTaskId(null);
                                    onOpenEditor(task);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[var(--text-main)] hover:bg-[var(--surface-soft)] font-semibold"
                                >
                                  ✏️ <span>Edit Details</span>
                                </button>

                                <div className="my-1 border-t border-[var(--border)]" />
                                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                                  Move to
                                </span>
                                {COLUMNS.filter((c) => c.key !== task.status).map((c) => (
                                  <button
                                    key={c.key}
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuTaskId(null);
                                      onStatusChange(task.id, c.key);
                                    }}
                                    className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-left text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)]"
                                  >
                                    <span className={`h-1.5 w-1.5 rounded-full ${c.tone}`} />
                                    <span>{c.label}</span>
                                  </button>
                                ))}

                                <div className="my-1 border-t border-[var(--border)]" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuTaskId(null);
                                    onDelete(task.id);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold"
                                >
                                  🗑️ <span>Delete Task</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Optional Description Preview */}
                        {task.description && (
                          <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--text-soft)] pl-6">
                            {task.description}
                          </p>
                        )}

                        {/* Rich Metadata Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 pl-6 pt-0.5 text-[10px]">
                          {/* Priority Pill with Rich Gradient */}
                          {task.priority === "URGENT" && (
                            <span className="rounded bg-gradient-to-r from-rose-500 to-pink-500 text-white font-extrabold uppercase px-1.5 py-0.5 text-[9px] shadow-2xs">
                              Urgent
                            </span>
                          )}
                          {task.priority === "HIGH" && (
                            <span className="rounded bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold uppercase px-1.5 py-0.5 text-[9px] shadow-2xs">
                              High
                            </span>
                          )}

                          {/* Rich Due Date Chip */}
                          {dueDate && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-bold ${
                                dueDate.isPast
                                  ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50"
                                  : dueDate.isToday
                                  ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50"
                                  : "bg-[var(--surface-strong,#ffffff)] border border-[var(--border)] text-[var(--text-soft)]"
                              }`}
                            >
                              {dueDate.isPast ? "🚨" : dueDate.isToday ? "⚡" : "📅"} {dueDate.label}
                            </span>
                          )}

                          {/* Checklist Subtasks Count */}
                          {totalSubtasks > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-strong,#ffffff)] border border-[var(--border)] px-1.5 py-0.5 text-[var(--text-soft)] font-semibold">
                              ☑ {doneSubtasks}/{totalSubtasks}
                            </span>
                          )}
                        </div>

                        {/* Bottom Row: Assignee Avatars & Progress */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-[var(--border)] pl-6">
                          {/* Assignee Avatars */}
                          <div className="flex items-center -space-x-1.5 overflow-hidden">
                            {task.assignments.length > 0 ? (
                              task.assignments.slice(0, 3).map((a) => (
                                <div
                                  key={a.id}
                                  className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-white text-[9px] font-bold border border-white dark:border-slate-900 shadow-2xs"
                                  title={a.user.name}
                                >
                                  {a.user.name.charAt(0).toUpperCase()}
                                </div>
                              ))
                            ) : (
                              <span className="text-[10px] text-[var(--text-faint)]">Unassigned</span>
                            )}
                            {task.assignments.length > 3 && (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--text-soft)] text-[9px] font-bold border border-[var(--border)]">
                                +{task.assignments.length - 3}
                              </div>
                            )}
                          </div>

                          {/* Progress percentage */}
                          {totalSubtasks > 0 && (
                            <span className="text-[10px] text-[var(--text-faint)] font-bold">
                              {task.progress}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Inline Edit Form when editing */}
                      {isEditing && (
                        <div className="mt-3 grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3 animate-in fade-in duration-100 shadow-xs">
                          <input
                            className="h-8 rounded-lg border px-2 text-xs outline-none focus:border-[var(--accent)]"
                            style={FIELD_STYLE}
                            value={editTaskForm.title}
                            onChange={(e) => onEditTaskFormChange("title", e.target.value)}
                            placeholder="Task title"
                          />
                          <textarea
                            rows={2}
                            className="rounded-lg border p-2 text-xs outline-none focus:border-[var(--accent)]"
                            style={FIELD_STYLE}
                            value={editTaskForm.description}
                            onChange={(e) => onEditTaskFormChange("description", e.target.value)}
                            placeholder="Task description"
                          />
                          <div className="grid grid-cols-2 gap-1.5">
                            <select
                              className="h-7 w-full rounded-lg border px-1.5 text-[11px] outline-none"
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
                              className="h-7 w-full rounded-lg border px-1.5 text-[11px] outline-none"
                              style={FIELD_STYLE}
                              value={editTaskForm.deadlineAt}
                              onChange={(e) => onEditTaskFormChange("deadlineAt", e.target.value)}
                            />
                          </div>

                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              type="button"
                              onClick={onCancelEdit}
                              className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={onSaveEdit}
                              className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-white shadow-2xs"
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
                  <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-center text-xs text-[var(--text-soft)]">
                    No tasks in this column.
                  </div>
                )}
              </div>

              {/* Fast Inline "+ Add task" Creation Row */}
              {onQuickCreate && (
                <div className="mt-2.5 pt-2 border-t border-[var(--border)] shrink-0">
                  {addingCol === col.key ? (
                    <div className="space-y-1.5 animate-in fade-in duration-100">
                      <input
                        autoFocus
                        type="text"
                        value={newTitle}
                        disabled={isSubmittingQuick}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleQuickAdd(col.key);
                          } else if (e.key === "Escape") {
                            setAddingCol(null);
                            setNewTitle("");
                          }
                        }}
                        placeholder="Task name... (Press Enter to add)"
                        className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAddingCol(null);
                            setNewTitle("");
                          }}
                          className="rounded-lg px-2 py-1 text-xs text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!newTitle.trim() || isSubmittingQuick}
                          onClick={() => void handleQuickAdd(col.key)}
                          className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50 shadow-2xs"
                        >
                          {isSubmittingQuick ? "Adding..." : "Add"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddingCol(col.key);
                        setNewTitle("");
                      }}
                      className="flex items-center gap-1.5 w-full rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-[var(--accent)] transition-colors"
                    >
                      <span className="text-sm font-bold text-[var(--accent)]">+</span>
                      <span>Add a task</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
