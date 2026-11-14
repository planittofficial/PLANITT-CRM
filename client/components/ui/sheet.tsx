import { useEffect, type ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
}

const widthStyles = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
};

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`relative z-10 flex h-full w-full flex-col bg-[var(--surface-strong,#ffffff)] shadow-2xl transition-transform duration-200 ease-out border-l border-[var(--border)] ${widthStyles[width]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--border)] p-4 sm:p-5">
          <div className="min-w-0 pr-4">
            <h2 id="sheet-title" className="text-base font-semibold text-[var(--text-main)] truncate">
              {title}
            </h2>
            {description && <p className="mt-1 text-xs text-[var(--text-soft)]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)] transition-colors"
            aria-label="Close sheet"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">{children}</div>

        {/* Footer */}
        {footer && <div className="border-t border-[var(--border)] p-4 sm:p-5 bg-[var(--surface-soft)]">{footer}</div>}
      </div>
    </div>
  );
}
