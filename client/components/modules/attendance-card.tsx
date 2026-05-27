"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { showToast } from "@/hooks/use-toast";

type AttendanceCardProps = {
  initialCheckedIn?: boolean;
};

export function AttendanceCard({ initialCheckedIn = false }: AttendanceCardProps) {
  const [checkedIn, setCheckedIn] = useState(initialCheckedIn);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    initialCheckedIn ? "You are currently checked in." : "Start the day when you're ready."
  );

  useEffect(() => {
    setCheckedIn(initialCheckedIn);
    setMessage(
      initialCheckedIn ? "You are currently checked in." : "Start the day when you're ready."
    );
  }, [initialCheckedIn]);

  const handleAttendance = async () => {
    try {
      setLoading(true);
      setMessage("");

      if (checkedIn) {
        await apiPost("/attendance/checkout");
        setCheckedIn(false);
        showToast("Checked out successfully." , "error");
        window.dispatchEvent(new CustomEvent("attendance:local-updated"));
        return;
      }

      await apiPost("/attendance/checkin");
      setCheckedIn(true);
      showToast("Checked in successfully." , "success");
      window.dispatchEvent(new CustomEvent("attendance:local-updated"));
    } catch (error) {
      const err = error as Error & { status?: number };

      if (err.status === 409) {
        setCheckedIn(true);
        setMessage("You are already checked in. Use the button again when you leave.");
        return;
      }

      if (err.status === 404) {
        setCheckedIn(false);
        setMessage("No open check-in was found.");
        return;
      }

      setMessage(err.message || "Attendance action failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="overflow-hidden rounded-lg border p-5"
      style={{
        background:
          "linear-gradient(145deg, var(--surface) 0%, color-mix(in srgb, var(--surface-soft) 86%, var(--accent) 14%) 100%)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-faint)]">
            Attendance
          </p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text-main)]">
            {checkedIn ? "Checked in" : "Ready to start?"}
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--text-soft)]">{message}</p>
          <div className="mt-4 grid max-w-sm grid-cols-3 gap-2">
            {["Check in", "Focus", "Checkout"].map((label, index) => (
              <div
                key={label}
                className="rounded-md border px-3 py-2 text-center"
                style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                  {label}
                </p>
                <p className="mt-1 text-xs font-bold text-[var(--text-main)]">
                  {index === 0 && checkedIn ? "Done" : index === 2 && !checkedIn ? "Later" : "Now"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleAttendance}
          disabled={loading}
          className="crm-gradient-button mx-auto flex h-36 w-36 items-center justify-center rounded-full text-center text-base font-bold transition disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? "Please wait" : checkedIn ? "Check out" : "Check in"}
        </button>
      </div>
    </div>
  );
}
