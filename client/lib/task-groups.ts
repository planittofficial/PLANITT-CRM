import type { Task, TaskPriority } from "@/types/crm";

export const TASK_PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const priorityWeight: Record<TaskPriority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const priorityBadgeClass = {
  LOW: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",

  MEDIUM: "bg-sky-500/15 text-sky-400 border border-sky-500/30",

  HIGH: "bg-orange-500/15 text-orange-400 border border-orange-500/30",

  URGENT: "bg-rose-500/15 text-rose-400 border border-rose-500/30",
};

export function compareTaskPriority(a: Task, b: Task): number {
  const pa = priorityWeight[a.priority ?? "MEDIUM"] ?? 2;
  const pb = priorityWeight[b.priority ?? "MEDIUM"] ?? 2;
  if (pb !== pa) {
    return pb - pa;
  }
  const ta = a.createdAt ?? "";
  const tb = b.createdAt ?? "";
  return tb.localeCompare(ta);
}

export type AssigneeTaskGroup = {
  key: string;
  label: string;
  tasks: Task[];
};

function assigneeBucketMeta(task: Task): { key: string; label: string } {
  const as = task.assignments ?? [];
  if (as.length === 0) {
    return { key: "unassigned", label: "Unassigned" };
  }
  if (as.length === 1) {
    return { key: `user:${as[0].userId}`, label: as[0].user.name };
  }
  const sorted = [...as].sort((x, y) => x.userId.localeCompare(y.userId));
  return {
    key: `multi:${sorted.map((x) => x.userId).join(":")}`,
    label: sorted.map((x) => x.user.name).join(", "),
  };
}

/** One card per unique assignee set; tasks sorted by priority then recency. */
export function groupTasksByAssignees(tasks: Task[]): AssigneeTaskGroup[] {
  const buckets = new Map<string, { label: string; tasks: Task[] }>();

  for (const task of tasks) {
    const { key, label } = assigneeBucketMeta(task);
    const existing = buckets.get(key);
    if (existing) {
      existing.tasks.push(task);
    } else {
      buckets.set(key, { label, tasks: [task] });
    }
  }

  const groups = Array.from(buckets.entries()).map(([key, value]) => ({
    key,
    label: value.label,
    tasks: [...value.tasks].sort(compareTaskPriority),
  }));

  groups.sort((a, b) => {
    if (a.key === "unassigned") {
      return 1;
    }
    if (b.key === "unassigned") {
      return -1;
    }
    return a.label.localeCompare(b.label);
  });

  return groups;
}
