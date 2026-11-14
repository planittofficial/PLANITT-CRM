import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightIcon, helperText, className = "", id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 flex items-center text-[var(--text-soft)]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`h-9 w-full rounded-lg border bg-[var(--surface-soft)] px-3 text-sm text-[var(--text-main)] outline-none transition-all placeholder:text-[var(--text-faint)] focus:border-blue-500 focus:bg-[var(--surface-strong,#ffffff)] focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 ${
              leftIcon ? "pl-9" : ""
            } ${rightIcon ? "pr-9" : ""} ${
              error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" : "border-[var(--border)]"
            } ${className}`.trim()}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center text-[var(--text-soft)]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
        {helperText && !error && <p className="text-xs text-[var(--text-faint)]">{helperText}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = "", id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-soft)]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`min-h-[80px] w-full rounded-lg border bg-[var(--surface-soft)] p-3 text-sm text-[var(--text-main)] outline-none transition-all placeholder:text-[var(--text-faint)] focus:border-blue-500 focus:bg-[var(--surface-strong,#ffffff)] focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 ${
            error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" : "border-[var(--border)]"
          } ${className}`.trim()}
          {...props}
        />
        {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
        {helperText && !error && <p className="text-xs text-[var(--text-faint)]">{helperText}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
