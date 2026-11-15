"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { showToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ClockIcon, CheckSquareIcon } from "@/components/ui/icons";

type AttendanceCardProps = {
  initialCheckedIn?: boolean;
};

export function AttendanceCard({ initialCheckedIn = false }: AttendanceCardProps) {
  const [checkedIn, setCheckedIn] = useState(initialCheckedIn);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    initialCheckedIn ? "You are currently marked active and working." : "You have not checked in yet for today."
  );

  useEffect(() => {
    setCheckedIn(initialCheckedIn);
    setMessage(
      initialCheckedIn ? "You are currently marked active and working." : "You have not checked in yet for today."
    );
  }, [initialCheckedIn]);

  const handleAttendance = async () => {
    try {
      setLoading(true);
      setMessage("");

      if (checkedIn) {
        await apiPost("/attendance/checkout");
        setCheckedIn(false);
        setMessage("You are checked out for the day.");
        showToast("Checked out successfully.", "success");
        window.dispatchEvent(new CustomEvent("attendance:local-updated"));
        return;
      }

      await apiPost("/attendance/checkin");
      setCheckedIn(true);
      setMessage("You are currently marked active and working.");
      showToast("Checked in successfully.", "success");
      window.dispatchEvent(new CustomEvent("attendance:local-updated"));
    } catch (error) {
      const err = error as Error & { status?: number };

      if (err.status === 409) {
        setCheckedIn(true);
        setMessage("You are already checked in. Use Check Out when you leave.");
        return;
      }

      if (err.status === 404) {
        setCheckedIn(false);
        setMessage("No open check-in was found.");
        return;
      }

      setMessage(err.message || "Attendance action failed.");
      showToast(err.message || "Attendance action failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
              checkedIn
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
            }`}
          >
            <ClockIcon size={20} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[var(--text-main)]">Daily Attendance</h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                  checkedIn
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    checkedIn ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                  }`}
                />
                {checkedIn ? "Active / Checked In" : "Not Checked In"}
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--text-soft)]">{message}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <Button
            type="button"
            onClick={handleAttendance}
            disabled={loading}
            loading={loading}
            variant={checkedIn ? "outline" : "primary"}
            size="md"
            className={
              checkedIn
                ? "border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
                : ""
            }
          >
            {checkedIn ? "Check Out" : "Check In Now"}
          </Button>
        </div>
      </div>
    </div>
  );
}
