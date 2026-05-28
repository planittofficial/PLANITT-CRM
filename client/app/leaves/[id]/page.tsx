"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CRMShell } from "@/components/layout/crm-shell";
import { renderSessionGate } from "@/components/shared/session-gate";
import { useSession } from "@/hooks/use-session";
import { apiGet, apiPost, apiPut, resolveApiOrigin } from "@/lib/api";
import type { LeaveComment, LeaveRequest } from "@/types/crm";

function statusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "MORE_INFORMATION":
      return "Need more info";
    case "ALTERNATIVE_SUGGESTED":
      return "Alternative suggested";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export default function LeaveDetailPage() {
  const params = useParams();
  const leaveId = String(params?.id ?? "");
  const router = useRouter();
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession();
  const [leave, setLeave] = useState<LeaveRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const canManage = useMemo(() => {
    if (!user || !leave) return false;
    return (
      user.role === "SUPERADMIN" ||
      user.role === "ADMIN" ||
      (user.role === "MANAGER" && leave.manager?.id === user.id)
    );
  }, [leave, user]);

  const isOwner = useMemo(() => {
    return user?.id === leave?.user.id;
  }, [leave, user]);

  const attachmentHref = leave?.attachmentUrl
    ? leave.attachmentUrl.startsWith("/")
      ? `${resolveApiOrigin()}${leave.attachmentUrl}`
      : leave.attachmentUrl
    : "";

  useEffect(() => {
    async function loadLeave() {
      try {
        setError("");
        const data = await apiGet<LeaveRequest>(`/leaves/${leaveId}`);
        setLeave(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load leave details");
      } finally {
        setLoading(false);
      }
    }

    if (user && leaveId) {
      void loadLeave();
    }
  }, [user, leaveId]);

  const sessionGate = renderSessionGate({
    loading: sessionLoading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading leave details",
    loadingDescription: "Fetching request and comments.",
  });

  if (sessionGate) {
    return sessionGate;
  }

  if (!user) {
    return null;
  }

  const handleAction = async (newStatus: string) => {
    if (!leave) return;
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      await apiPut(`/leaves/${leave.id}/status`, { status: newStatus, note });
      setNotice("Leave status updated.");
      setNote("");
      const updated = await apiGet<LeaveRequest>(`/leaves/${leave.id}`);
      setLeave(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update leave status");
    } finally {
      setSubmitting(false);
    }
  };

  const handleComment = async () => {
    if (!leave || !comment.trim()) {
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      await apiPost(`/leaves/${leave.id}/comments`, { message: comment.trim() });
      setComment("");
      const updated = await apiGet<LeaveRequest>(`/leaves/${leave.id}`);
      setLeave(updated);
      setNotice("Comment added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!leave) return;
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      await apiPut(`/leaves/${leave.id}`, { cancel: true });
      const updated = await apiGet<LeaveRequest>(`/leaves/${leave.id}`);
      setLeave(updated);
      setNotice("Leave request cancelled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel leave request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CRMShell user={user}>
      <div className="min-w-0 overflow-x-hidden pb-4">
        <section className="rounded-[20px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Leave request</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]">Request details</h1>
            </div>
            <Link href="/leaves" className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-[var(--text-main)] transition hover:bg-slate-100">
              Back to leaves
            </Link>
          </div>
        </section>

        {loading ? (
          <p className="mt-5 text-sm text-[var(--text-soft)]">Loading leave details...</p>
        ) : error ? (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
        ) : leave ? (
          <div className="mt-5 space-y-5">
            <section className="rounded-[20px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
              <div className="grid gap-5 lg:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-faint)]">Status</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">{statusLabel(leave.status)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-faint)]">Period</p>
                  <p className="mt-2 text-sm text-[var(--text-main)]">
                    {new Date(leave.startDate).toLocaleDateString()} – {new Date(leave.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-faint)]">Assigned manager</p>
                  <p className="mt-2 text-sm text-[var(--text-main)]">{leave.manager?.name ?? "Not assigned"}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[20px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-faint)]">Type</p>
                  <p className="mt-2 text-sm text-[var(--text-main)]">{leave.leaveType?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-faint)]">Requested by</p>
                  <p className="mt-2 text-sm text-[var(--text-main)]">{leave.user.name}</p>
                </div>
              </div>
              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-faint)]">Reason</p>
                <p className="mt-2 whitespace-pre-line text-sm text-[var(--text-main)]">{leave.reason || "No reason provided."}</p>
              </div>
              {leave.attachmentUrl ? (
                <div className="mt-6">
                  <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-faint)]">Attachment</p>
                  <p className="mt-2 text-sm text-blue-600">
                    <a href={attachmentHref} target="_blank" rel="noreferrer" className="underline">
                      View document
                    </a>
                  </p>
                </div>
              ) : null}
            </section>

            {canManage ? (
              <section className="rounded-[20px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
                <p className="text-sm font-semibold text-[var(--text-main)]">Manager actions</p>
                <p className="mt-2 text-sm text-[var(--text-soft)]">Use a note when approving, rejecting, or requesting more information.</p>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="crm-input mt-3 w-full rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 text-sm"
                  placeholder="Add a note or request details"
                />
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void handleAction("APPROVED")}
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-2xl bg-green-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAction("REJECTED")}
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAction("MORE_INFORMATION")}
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-2xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Request info
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAction("ALTERNATIVE_SUGGESTED")}
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Suggest alternative
                  </button>
                </div>
              </section>
            ) : null}

            {isOwner && leave.status === "PENDING" ? (
              <section className="rounded-[20px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
                <p className="text-sm font-semibold text-[var(--text-main)]">Cancel request</p>
                <p className="mt-2 text-sm text-[var(--text-soft)]">Cancel this leave request if you no longer need it.</p>
                <button
                  type="button"
                  onClick={() => void handleCancel()}
                  disabled={submitting}
                  className="mt-4 inline-flex items-center justify-center rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel request
                </button>
              </section>
            ) : null}

            <section className="rounded-[20px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-main)]">Conversation thread</p>
                  <p className="mt-2 text-sm text-[var(--text-soft)]">Comments are visible to both requesters and approvers.</p>
                </div>
              </div>
              {leave.comments?.length ? (
                <div className="mt-5 space-y-3">
                  {leave.comments.map((thread) => (
                    <div key={thread.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                      <div className="flex items-center justify-between gap-3 text-sm text-[var(--text-faint)]">
                        <div>
                          <span className="font-semibold text-[var(--text-main)]">{thread.author.name}</span>
                          <span className="ml-2">· {thread.author.role}</span>
                        </div>
                        <span>{new Date(thread.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[var(--text-main)]">{thread.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-[var(--text-soft)]">No comments yet.</p>
              )}

              <div className="mt-5 space-y-3">
                {notice ? <p className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</p> : null}
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="crm-input w-full rounded-2xl border bg-[var(--surface-soft)] px-4 py-3 text-sm"
                  placeholder="Write a follow-up message"
                  rows={4}
                />
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => void handleComment()}
                    disabled={submitting || !comment.trim()}
                    className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Post comment
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </CRMShell>
  );
}
