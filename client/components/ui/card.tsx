import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "subtle" | "interactive";
  children: ReactNode;
}

const variantStyles = {
  default:
    "bg-[var(--surface-strong,#ffffff)] border border-[var(--border)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
  elevated:
    "bg-[var(--surface-strong,#ffffff)] border border-[var(--border)] shadow-[0_4px_12px_rgba(0,0,0,0.06)]",
  subtle:
    "bg-[var(--surface-soft)] border border-[var(--border)]",
  interactive:
    "bg-[var(--surface-strong,#ffffff)] border border-[var(--border)] hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-150 cursor-pointer shadow-sm hover:shadow-md",
};

export function Card({
  variant = "default",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-xl overflow-hidden ${variantStyles[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-[var(--border)] ${className}`.trim()}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight text-[var(--text-main)] truncate">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--text-soft)] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardContent({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`p-4 sm:p-5 ${className}`.trim()}>{children}</div>;
}
