"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CRMShell } from "@/components/layout/crm-shell";
import { renderSessionGate } from "@/components/shared/session-gate";
import { useSession } from "@/hooks/use-session";
import { apiGet, apiPost, apiPostForm } from "@/lib/api";
import type { LeaveType } from "@/types/crm";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

function isValidAttachment(file: File) {
  return ["image/", "application/pdf"].some((prefix) => file.type.startsWith(prefix));
}

export default function NewLeavePage() {
  const router = useRouter();
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [form, setForm] = useState({
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
    attachmentFile: null as File | null,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      return;
    }

    async function loadTypes() {
      try {
        setError("");
        setLoading(true);

        const types = await apiGet<LeaveType[]>("/leaves/types");
        setLeaveTypes(types);
        if (types.length > 0) {
          setForm((current) => ({ ...current, leaveTypeId: current.leaveTypeId || types[0].id }));
        }
      } catch (err) {
        if (err && typeof err === "object" && "status" in err && typeof (err as any).status === "number") {
          const status = (err as any).status as number;
          setError(`Unable to load leave types (HTTP ${status}).`);
        } else {
          setError(err instanceof Error ? err.message : "Unable to load leave types");
        }
      } finally {
        setLoading(false);
      }
    }

    void loadTypes();
  }, [user]);

  const sessionGate = renderSessionGate({
    loading: sessionLoading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading leave application",
    loadingDescription: "Preparing the leave request form.",
  });

  if (sessionGate) {
    return sessionGate;
  }

  if (!user) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      let attachmentUrl = null;
      if (form.attachmentFile) {
        if (form.attachmentFile.size > MAX_ATTACHMENT_SIZE) {
          throw new Error("Attachment must be 10MB or smaller.");
        }
        if (!isValidAttachment(form.attachmentFile)) {
          throw new Error("Only image and PDF files are allowed.");
        }

        const formData = new FormData();
        formData.append("file", form.attachmentFile);
        const upload = await apiPostForm<{ attachmentUrl: string }>("/leaves/attachments", formData);
        attachmentUrl = upload.attachmentUrl;
      }

      await apiPost("/leaves", {
        leaveTypeId: form.leaveTypeId,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason,
        attachmentUrl,
      });

      setNotice("Leave request submitted successfully.");
      router.push("/leaves");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit leave request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CRMShell user={user}>
      <div className="min-w-0 overflow-x-hidden pb-4">
        <section className="rounded-[20px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Leave request</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]">Apply for leave</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
            Submit your leave request and it will be routed to your assigned manager or department head.
          </p>
        </section>

        <section className="rounded-[20px] border p-6" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            {notice ? <p className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</p> : null}

            <div className="grid gap-5 lg:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-[var(--text-main)]">Leave type</span>
                <select
                  value={form.leaveTypeId}
                  onChange={(event) => setForm((current) => ({ ...current, leaveTypeId: event.target.value }))}
                  className="crm-input mt-2 w-full rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 text-sm"
                  required
                  disabled={loading || leaveTypes.length === 0}
                >
                  <option value="" disabled>
                    {loading ? "Loading leave types..." : error ? "Leave types unavailable" : "Choose leave type"}
                  </option>
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[var(--text-main)]">Supporting document</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="mt-2 text-sm text-[var(--text-main)]"
                  onChange={(event) => setForm((current) => ({ ...current, attachmentFile: event.target.files?.[0] ?? null }))}
                />
              </label>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-[var(--text-main)]">Start date</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                  className="crm-input mt-2 w-full rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 text-sm"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[var(--text-main)]">End date</span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                  className="crm-input mt-2 w-full rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 text-sm"
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-[var(--text-main)]">Reason</span>
              <textarea
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                className="crm-input mt-2 min-h-[160px] w-full rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 text-sm"
                placeholder="Add context for your leave request"
                required
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/leaves" className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-[var(--text-main)] transition hover:bg-slate-100">
                Back to leave requests
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit leave request"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </CRMShell>
  );
}
