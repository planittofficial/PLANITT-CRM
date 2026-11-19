"use client";

import { useState, useEffect, useRef } from "react";
import { apiPost, apiGet } from "@/lib/api";
import { showToast } from "@/hooks/use-toast";
import { usePresence } from "@/components/providers/presence-provider";
import { VideoIcon, PlusIcon, XIcon, CheckSquareIcon, UsersIcon, ClockIcon } from "@/components/ui/icons";
import type { CRMUser } from "@/types/crm";

type FloatingQuickActionProps = {
  user: CRMUser;
};

export function FloatingQuickAction({ user }: FloatingQuickActionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<"LEAD" | "TASK" | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Quick Lead Form State
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadValue, setLeadValue] = useState("");
  const [leadCompany, setLeadCompany] = useState("");

  // Quick Task Form State
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");

  const { setMeetingStatus } = usePresence();
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Sync attendance status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await apiGet<{ checkedIn: boolean }>("/attendance/status");
        setCheckedIn(Boolean(res.checkedIn));
      } catch {
        // Fallback
      }
    };
    void fetchStatus();

    const onAttendanceUpdated = () => void fetchStatus();
    window.addEventListener("attendance:local-updated", onAttendanceUpdated);
    return () => window.removeEventListener("attendance:local-updated", onAttendanceUpdated);
  }, []);

  // Close menu on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setActiveModal(null);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen || activeModal) {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, activeModal]);

  // 1-Tap Attendance Check-In / Out
  const handleToggleAttendance = async () => {
    try {
      setAttendanceLoading(true);
      if (checkedIn) {
        await apiPost("/attendance/checkout");
        setCheckedIn(false);
        showToast("Checked out of shift successfully.", "success");
      } else {
        await apiPost("/attendance/checkin");
        setCheckedIn(true);
        showToast("Checked in successfully! Shift started.", "success");
      }
      window.dispatchEvent(new CustomEvent("attendance:local-updated"));
      setIsOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update attendance", "error");
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Instant Google Meet with Auto-Meeting Presence
  const handleInstantMeet = async () => {
    try {
      setActionLoading(true);
      const res = await apiPost<{ meetUrl: string }>("/calendar/quick-meet", {
        title: `${user.name} Instant Google Meet`,
      });
      if (res.meetUrl) {
        await setMeetingStatus(`${user.name} Instant Google Meet`);
        window.open(res.meetUrl, "_blank");
        await navigator.clipboard.writeText(res.meetUrl).catch(() => {});
        showToast("Google Meet launched! Status automatically set to In a Meeting (🔴)", "success");
        setIsOpen(false);
      }
    } catch {
      showToast("Failed to launch Google Meet", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Create Quick Lead
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName.trim()) {
      showToast("Lead name is required", "error");
      return;
    }
    try {
      setActionLoading(true);
      await apiPost("/crm/leads", {
        name: leadName.trim(),
        phone: leadPhone.trim() || null,
        email: leadEmail.trim() || null,
        company: leadCompany.trim() || null,
        value: leadValue ? parseFloat(leadValue) : 0,
        status: "NEW",
      });
      showToast(`Lead "${leadName.trim()}" added to pipeline!`, "success");
      setLeadName("");
      setLeadPhone("");
      setLeadEmail("");
      setLeadValue("");
      setLeadCompany("");
      setActiveModal(null);
      setIsOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create lead", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Create Quick Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      showToast("Task title is required", "error");
      return;
    }
    try {
      setActionLoading(true);
      await apiPost("/tasks", {
        title: taskTitle.trim(),
        priority: taskPriority,
        status: "TODO",
      });
      showToast(`Task "${taskTitle.trim()}" created!`, "success");
      setTaskTitle("");
      setTaskPriority("MEDIUM");
      setActiveModal(null);
      setIsOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create task", "error");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Trigger Container */}
      <div
        ref={menuRef}
        className="fixed z-40 right-4 sm:right-6 bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] sm:bottom-6 flex flex-col items-end pointer-events-auto"
      >
        {/* Expanded Quick Action Popover */}
        {isOpen && (
          <div className="mb-3 w-64 rounded-2xl border border-[var(--gold-border)] bg-[var(--surface-strong)] p-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-150">
            <div className="px-3 py-2 border-b border-[var(--border)]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                Planitt CRM Copilot
              </p>
              <p className="text-xs text-[var(--text-soft)]">1-Tap Executive Actions</p>
            </div>

            <div className="mt-1 space-y-1">
              {/* 1. Instant Google Meet */}
              <button
                type="button"
                onClick={handleInstantMeet}
                disabled={actionLoading}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--gold-subtle)] transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                  <VideoIcon size={16} />
                </div>
                <div>
                  <p className="font-bold">Instant Google Meet</p>
                  <p className="text-[10px] text-[var(--text-soft)]">Auto-sets status to In Meeting (🔴)</p>
                </div>
              </button>

              {/* 2. Quick Attendance Shift */}
              <button
                type="button"
                onClick={handleToggleAttendance}
                disabled={attendanceLoading}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--gold-subtle)] transition-colors"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                  checkedIn ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                }`}>
                  <ClockIcon size={16} />
                </div>
                <div>
                  <p className="font-bold">{checkedIn ? "Check Out Shift" : "Quick Check In"}</p>
                  <p className="text-[10px] text-[var(--text-soft)]">
                    {checkedIn ? "Shift currently active" : "Log attendance in 1 tap"}
                  </p>
                </div>
              </button>

              {/* 3. Add New Lead */}
              <button
                type="button"
                onClick={() => {
                  setActiveModal("LEAD");
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--gold-subtle)] transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gold-subtle)] text-[var(--accent)] shrink-0">
                  <UsersIcon size={16} />
                </div>
                <div>
                  <p className="font-bold">Add New Lead</p>
                  <p className="text-[10px] text-[var(--text-soft)]">Fast-track investor into CRM</p>
                </div>
              </button>

              {/* 4. Log Quick Task */}
              <button
                type="button"
                onClick={() => {
                  setActiveModal("TASK");
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--gold-subtle)] transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                  <CheckSquareIcon size={16} />
                </div>
                <div>
                  <p className="font-bold">Log Quick Task</p>
                  <p className="text-[10px] text-[var(--text-soft)]">Add deliverable to planner</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Master Floating Gold Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? "Close Quick Actions Menu" : "Open Planitt Quick Actions Hub"}
          className="group relative flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-tr from-[#D4AF37] to-[#B8860B] text-black shadow-lg shadow-[rgba(212,175,55,0.4)] transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--gold)] focus:ring-offset-2"
        >
          {/* Subtle Outer Pulsing Halo */}
          <span className="absolute -inset-1 rounded-full bg-[var(--gold)] opacity-30 blur-xs group-hover:opacity-50 transition-opacity animate-pulse" />
          <div className="relative z-10 transition-transform duration-200">
            {isOpen ? <XIcon size={22} className="stroke-[2.5]" /> : <PlusIcon size={24} className="stroke-[2.5]" />}
          </div>
        </button>
      </div>

      {/* Quick Add Lead Modal */}
      {activeModal === "LEAD" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-lead-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--gold-border)] bg-[var(--surface-strong)] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 id="quick-lead-title" className="text-base font-bold text-[var(--text-main)]">
                  Add New Investor Lead
                </h3>
                <p className="text-xs text-[var(--text-soft)]">Directly capture lead into Planitt CRM pipeline</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
              >
                <XIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-main)]">Lead / Investor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Sharma"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-main)] placeholder-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-main)]">Phone (WhatsApp)</label>
                  <input
                    type="tel"
                    placeholder="919876543210"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-main)] placeholder-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-main)]">Email</label>
                  <input
                    type="email"
                    placeholder="investor@domain.com"
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-main)] placeholder-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-main)]">Portfolio / Company</label>
                  <input
                    type="text"
                    placeholder="e.g. HNI Capital"
                    value={leadCompany}
                    onChange={(e) => setLeadCompany(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-main)] placeholder-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-main)]">Target Value (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={leadValue}
                    onChange={(e) => setLeadValue(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-main)] placeholder-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="crm-gold-btn rounded-xl px-4 py-2 text-xs"
                >
                  {actionLoading ? "Saving..." : "Add to Pipeline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Task Modal */}
      {activeModal === "TASK" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-task-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--gold-border)] bg-[var(--surface-strong)] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 id="quick-task-title" className="text-base font-bold text-[var(--text-main)]">
                  Log Quick Task
                </h3>
                <p className="text-xs text-[var(--text-soft)]">Add deliverable to team task planner</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1.5 text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
              >
                <XIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-main)]">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Audit Q3 Quant Backtest Reports"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text-main)] placeholder-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-main)]">Priority Level</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {(["LOW", "MEDIUM", "HIGH"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTaskPriority(p)}
                      className={`rounded-xl py-1.5 text-xs font-bold border transition-colors ${
                        taskPriority === p
                          ? p === "HIGH"
                            ? "bg-rose-500/15 border-rose-500 text-rose-500"
                            : p === "MEDIUM"
                            ? "bg-[var(--gold-subtle)] border-[var(--accent)] text-[var(--accent)]"
                            : "bg-blue-500/15 border-blue-500 text-blue-500"
                          : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-soft)]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="crm-gold-btn rounded-xl px-4 py-2 text-xs"
                >
                  {actionLoading ? "Creating..." : "Save Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
