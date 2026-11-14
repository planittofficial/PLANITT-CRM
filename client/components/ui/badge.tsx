import type { HTMLAttributes } from "react";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline"
  | "purple";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50",
  secondary: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700/60",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
  danger: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50",
  info: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/50",
  outline: "bg-transparent text-[var(--text-main)] border-[var(--border)]",
  purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50",
};

export function Badge({
  variant = "default",
  size = "md",
  className = "",
  children,
  ...props
}: BadgeProps) {
  const sizeStyle = size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium tracking-wide transition-colors ${sizeStyle} ${variantStyles[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}

export function TaskStatusBadge({ status }: { status: "TODO" | "IN_PROGRESS" | "DONE" | string }) {
  switch (status) {
    case "DONE":
      return <Badge variant="success" size="sm">Done</Badge>;
    case "IN_PROGRESS":
      return <Badge variant="info" size="sm">In Progress</Badge>;
    case "TODO":
    default:
      return <Badge variant="secondary" size="sm">Todo</Badge>;
  }
}

export function TaskPriorityBadge({ priority }: { priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string }) {
  switch (priority) {
    case "URGENT":
      return <Badge variant="danger" size="sm">Urgent</Badge>;
    case "HIGH":
      return <Badge variant="warning" size="sm">High</Badge>;
    case "MEDIUM":
      return <Badge variant="default" size="sm">Medium</Badge>;
    case "LOW":
    default:
      return <Badge variant="secondary" size="sm">Low</Badge>;
  }
}

export function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case "SUPERADMIN":
      return <Badge variant="purple" size="sm">CEO</Badge>;
    case "ADMIN":
      return <Badge variant="default" size="sm">Admin</Badge>;
    case "MANAGER":
      return <Badge variant="info" size="sm">Manager</Badge>;
    case "EMPLOYEE":
      return <Badge variant="secondary" size="sm">Employee</Badge>;
    case "INTERN":
      return <Badge variant="outline" size="sm">Intern</Badge>;
    default:
      return <Badge variant="secondary" size="sm">{role}</Badge>;
  }
}
