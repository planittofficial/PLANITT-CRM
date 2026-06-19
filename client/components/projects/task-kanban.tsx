"use client";

import { MemberPickerToolbar, type MemberRoleFilter } from "@/components/shared/member-picker-toolbar";
import { TASK_PRIORITY_OPTIONS } from "@/lib/task-groups";
import { groupTasksByAssignees } from "@/lib/task-groups";
import { ResponsiveSelect } from "../shared/responsive-select";
import type { CRMUser, Task, TaskPriority, UserRole } from "@/types/crm";

type TaskFormState = { title: string; description: string; userIds: string[]; checklistText: string; priority: TaskPriority; deadlineAt: string };

const COLUMNS: Array<{ key: Task["status"]; label: string; tone: string }> = [
  { key: "TODO", label: "Pending", tone: "bg-rose-500" },
  { key: "IN_PROGRESS", label: "In Progress", tone: "bg-amber-500" },
  { key: "DONE", label: "Completed", tone: "bg-emerald-500" },
];

const FIELD_STYLE = { borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" } as const;

type Props = {
  groupedTasks: Record<Task["status"], Task[]>;
  editingTaskId: string; editTaskForm: TaskFormState;
  filteredAssignees: CRMUser[];
  assignQuery: string; onAssignQueryChange: (q: string) => void;
  assignRole: MemberRoleFilter; onAssignRoleChange: (r: MemberRoleFilter) => void;
  assignRoleOptions: UserRole[];
  onEditTaskFormChange: (field: keyof TaskFormState, value: string | string[]) => void;
  onOpenEditor: (task: Task) => void; onCancelEdit: () => void;
  onSaveEdit: () => void; onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: Task["status"]) => void;
  onPriorityChange: (taskId: string, priority: TaskPriority) => void;
  toggleEditAssignee: (userId: string) => void;
};

export function TaskKanban({ groupedTasks, editingTaskId, editTaskForm, filteredAssignees, assignQuery, onAssignQueryChange, assignRole, onAssignRoleChange, assignRoleOptions, onEditTaskFormChange, onOpenEditor, onCancelEdit, onSaveEdit, onDelete, onStatusChange, onPriorityChange, toggleEditAssignee }: Props) {
  return (
    <section className="grid gap-4 xl:grid-cols-3 xl:items-start">
      {COLUMNS.map((col) => (
        <div
          key={col.key}
          className="flex max-h-[min(55vh,520px)] flex-col overflow-hidden rounded-[20px] border p-4 sm:p-5 xl:max-h-[min(70vh,900px)]"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}
        >
          <div className="flex shrink-0 items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${col.tone}`} />
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">
              {col.label} ({groupedTasks[col.key].length})
            </h3>
          </div>
          <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
            {groupTasksByAssignees(groupedTasks[col.key]).map((group) => (
              <div key={group.key} className="rounded-[18px] border p-3" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface-soft) 92%, var(--border))" }}>
                <p className="mb-3 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>
                  {group.label}<span className="ml-2 font-normal normal-case text-[var(--text-faint)]">({group.tasks.length} task{group.tasks.length === 1 ? "" : "s"})</span>
                </p>
                <div className="space-y-3">
                  {group.tasks.map((task) => {
                    const done = task.checklistItems.filter((x) => x.completed).length;
                    return (
                      <article key={task.id} className="overflow-hidden rounded-2xl border p-3 sm:p-4" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <h4 className="line-clamp-2 break-words text-base font-semibold leading-snug text-[var(--text-main)] sm:text-lg">{task.title}</h4>
                            <p className="line-clamp-2 break-words text-sm leading-relaxed text-[var(--text-soft)]">{task.description || "No description"}</p>
                          </div>
                          <div className="grid gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <button type="button" onClick={() => onOpenEditor(task)} className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}>Edit</button>
                              <button type="button" onClick={() => onDelete(task.id)} className="rounded-full border px-3 py-1 text-xs font-semibold text-rose-600" style={{ borderColor: "var(--border)" }}>Delete</button>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <ResponsiveSelect
                              priorityColors
  value={task.priority ?? "MEDIUM"}
  onChange={(value) =>
    onPriorityChange(
      task.id,
      value as TaskPriority
    )
  }
  options={TASK_PRIORITY_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }))}
/>
                              <select value={task.status} onChange={(e) => onStatusChange(task.id, e.target.value as Task["status"])} className="h-9 w-full min-w-0 rounded-xl border px-3 text-xs font-semibold sm:w-auto" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }} title="Status">
                                {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                        {editingTaskId === task.id ? (
                          <div className="mt-4 grid gap-3 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                            <input className="h-11 rounded-2xl border px-3 text-sm outline-none" style={FIELD_STYLE} value={editTaskForm.title} onChange={(e) => onEditTaskFormChange("title", e.target.value)} />
                            <textarea className="min-h-24 rounded-2xl border px-3 py-3 text-sm outline-none" style={FIELD_STYLE} value={editTaskForm.description} onChange={(e) => onEditTaskFormChange("description", e.target.value)} />
                            <label className="grid gap-1.5">
                              <span className="text-xs font-semibold text-[var(--text-soft)]">Priority</span>
                              <select className="h-11 w-full min-w-0 rounded-2xl border px-3 text-sm outline-none" style={FIELD_STYLE} value={editTaskForm.priority} onChange={(e) => onEditTaskFormChange("priority", e.target.value)}>
                                {TASK_PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </label>
                            <label className="grid gap-1.5">
                              <span className="text-xs font-semibold text-[var(--text-soft)]">Deadline</span>
                              <input type="date" className="h-11 w-full min-w-0 rounded-2xl border px-3 text-sm outline-none" style={FIELD_STYLE} value={editTaskForm.deadlineAt} onChange={(e) => onEditTaskFormChange("deadlineAt", e.target.value)} />
                            </label>
                            <textarea className="min-h-24 rounded-2xl border px-3 py-3 text-sm outline-none" style={FIELD_STYLE} value={editTaskForm.checklistText} onChange={(e) => onEditTaskFormChange("checklistText", e.target.value)} />
                            <div className="grid gap-2">
                              <MemberPickerToolbar searchQuery={assignQuery} onSearchChange={onAssignQueryChange} roleFilter={assignRole} onRoleFilterChange={onAssignRoleChange} roleOptions={assignRoleOptions} />
                              <div className="grid gap-2 sm:grid-cols-2">
                                {filteredAssignees.length === 0 ? <p className="col-span-full rounded-2xl border px-3 py-4 text-sm text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>No matches. Adjust filters above.</p>
                                  : filteredAssignees.map((m) => (
                                    <label key={m.id} className="flex items-center gap-3 rounded-2xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}>
                                      <input type="checkbox" checked={editTaskForm.userIds.includes(m.id)} onChange={() => toggleEditAssignee(m.id)} />
                                      <span>{m.name}</span>
                                    </label>
                                  ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={onSaveEdit} className="rounded-2xl px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--accent-strong)" }}>Save</button>
                              <button type="button" onClick={onCancelEdit} className="rounded-2xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}>Cancel</button>
                            </div>
                          </div>
                        ) : null}
                        <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: "var(--surface)" }}>
                          <div className="h-full rounded-full bg-gradient-to-r from-slate-950 via-blue-600 to-emerald-500" style={{ width: `${task.progress}%` }} />
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-soft)]">
                          <span>{task.progress}% complete</span>
                          <span>{done}/{task.checklistItems.length} subtasks</span>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {task.assignments.map((a) => <span key={a.id} className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-soft)" }}>{a.user.name}</span>)}
                        </div>
                      </article>
                    );
                  })}
                </div>
                {!groupedTasks[col.key].length ? <div className="rounded-[18px] border border-dashed p-6 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-soft)" }}>No tasks in this column yet.</div> : null}
              </div>
            ))}
            {!groupedTasks[col.key].length ? (
              <div
                className="rounded-[18px] border border-dashed p-6 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-soft)" }}
              >
                No tasks in this column yet.
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  );
}
