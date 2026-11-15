import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "subtle";
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] hover:bg-[var(--accent-strong)] active:opacity-90 text-white shadow-xs border border-[var(--accent)] focus-visible:ring-[var(--accent)]",
  secondary:
    "bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-main)] border border-[var(--border)] focus-visible:ring-slate-400",
  outline:
    "bg-transparent hover:bg-[var(--surface-soft)] text-[var(--text-main)] border border-[var(--border)] focus-visible:ring-slate-400",
  ghost:
    "bg-transparent hover:bg-[var(--surface-soft)] text-[var(--text-main)] border border-transparent focus-visible:ring-slate-400",
  danger:
    "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs border border-rose-600 focus-visible:ring-rose-500",
  subtle:
    "bg-indigo-50 hover:bg-indigo-100 text-[var(--accent-strong)] border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/40",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "h-7 px-2 text-xs rounded-md gap-1",
  sm: "h-8 px-2.5 text-xs rounded-md gap-1.5 font-medium",
  md: "h-9 px-3.5 text-sm rounded-lg gap-2 font-medium",
  lg: "h-10 px-4 text-sm rounded-lg gap-2 font-semibold",
  icon: "h-8 w-8 p-0 rounded-lg justify-center",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center select-none font-sans outline-none transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-offset-1 ${sizeStyles[size]} ${variantStyles[variant]} ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
