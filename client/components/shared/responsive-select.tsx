"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ResponsiveSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type ResponsiveSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: ResponsiveSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  menuClassName?: string;
  buttonClassName?: string;
  ariaLabel?: string;
  priorityColors?: boolean;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 7.5 5 5 5-5" />
    </svg>
  );
}

export function ResponsiveSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  className = "",
  menuClassName = "",
  buttonClassName = "",
  ariaLabel,
  priorityColors = false,
}: ResponsiveSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value]
  );

  const priorityStyle = !priorityColors
    ? {
        borderColor: "var(--border)",
        background: "var(--surface-soft)",
        color: "var(--text-main)",
      }
    : value === "URGENT"
      ? {
          background: "#7f1d1d",
          color: "#fca5a5",
          borderColor: "#dc2626",
        }
      : value === "HIGH"
        ? {
            background: "#7c2d12",
            color: "#fdba74",
            borderColor: "#ea580c",
          }
        : value === "MEDIUM"
          ? {
              background: "#1e3a8a",
              color: "#93c5fd",
              borderColor: "#2563eb",
            }
          : value === "LOW"
            ? {
                background: "#14532d",
                color: "#86efac",
                borderColor: "#16a34a",
              }
            : {
                borderColor: "var(--border)",
                background: "var(--surface-soft)",
                color: "var(--text-main)",
              };

  const updateMenuPosition = () => {
    const node = rootRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setMenuRect({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    updateMenuPosition();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;

    const handleReposition = () => updateMenuPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const menu = document.getElementById(listboxId);
      if (menu?.contains(target)) return;
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, listboxId]);

  const menu =
    open && menuRect && typeof document !== "undefined"
      ? createPortal(
          <div
            id={listboxId}
            role="listbox"
            className={`z-[200] max-h-64 overflow-y-auto rounded-2xl border py-1 shadow-lg ${menuClassName}`.trim()}
            style={{
              position: "fixed",
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
              borderColor: "var(--border)",
              background: "var(--surface)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value || "__empty__"}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={option.disabled}
                  className="block w-full px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: selected ? "color-mix(in srgb, var(--accent) 14%, var(--surface))" : "transparent",
                    color: selected ? "var(--accent-strong)" : "var(--text-main)",
                  }}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="block break-words">{option.label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`.trim()}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-2xl border px-3 text-left text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`.trim()}
        style={priorityStyle}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{selectedOption?.label ?? placeholder}</span>
        <Chevron open={open} />
      </button>
      {menu}
    </div>
  );
}
