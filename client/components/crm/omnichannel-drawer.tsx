"use client";

import { useEffect, useState, useMemo } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { showToast } from "@/hooks/use-toast";
import { useSocket } from "@/components/providers/socket-provider";
import { Avatar } from "@/components/ui/avatar";
import type { Lead, Deal, LeadCommunication, OmnichannelTemplate, CRMUser } from "@/types/crm";

type OmnichannelDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  target: {
    type: "LEAD" | "DEAL";
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    value?: number | null;
    statusOrStage?: string;
  } | null;
  currentUser: CRMUser;
};

export function OmnichannelDrawer({
  isOpen,
  onClose,
  target,
  currentUser,
}: OmnichannelDrawerProps) {
  const { socket } = useSocket();
  const [activeChannel, setActiveChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
  const [communications, setCommunications] = useState<LeadCommunication[]>([]);
  const [templates, setTemplates] = useState<OmnichannelTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Composer Form
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  // Load communications and templates when drawer opens
  useEffect(() => {
    if (!isOpen || !target) return;

    setLoading(true);
    const queryParam = target.type === "LEAD" ? `leadId=${target.id}` : `dealId=${target.id}`;

    Promise.all([
      apiGet<LeadCommunication[]>(`/crm/communications?${queryParam}`),
      apiGet<OmnichannelTemplate[]>("/crm/omnichannel/templates"),
    ])
      .then(([comms, tmpls]) => {
        setCommunications(comms || []);
        setTemplates(tmpls || []);
      })
      .catch((err) => {
        showToast("Failed to load communications", "error");
      })
      .finally(() => setLoading(false));
  }, [isOpen, target]);

  // Listen for real-time incoming or outgoing messages
  useEffect(() => {
    if (!socket || !target) return;

    const handleNewComm = (comm: LeadCommunication) => {
      const matchLead = target.type === "LEAD" && comm.leadId === target.id;
      const matchDeal = target.type === "DEAL" && comm.dealId === target.id;
      if (matchLead || matchDeal) {
        setCommunications((prev) => {
          if (prev.some((c) => c.id === comm.id)) return prev;
          return [...prev, comm];
        });
      }
    };

    socket.on("crm:communication_new", handleNewComm);
    return () => {
      socket.off("crm:communication_new", handleNewComm);
    };
  }, [socket, target]);

  // Apply template replacement helper
  const applyTemplate = (tmpl: OmnichannelTemplate) => {
    if (!target) return;
    setSelectedTemplateId(tmpl.id);

    const firstName = target.name.split(" ")[0] || "Valued Investor";
    let bodyText = tmpl.body
      .replace(/\{\{name\}\}/g, firstName)
      .replace(/\{\{company\}\}/g, target.company || "Your Portfolio")
      .replace(/\{\{meet_url\}\}/g, `https://meet.google.com/planitt-${Math.random().toString(36).slice(2, 6)}`)
      .replace(/\{\{payment_link\}\}/g, "https://planitt.in/subscribe/elite")
      .replace(/\{\{rep_name\}\}/g, currentUser.name);

    let subjText = (tmpl.subject || "")
      .replace(/\{\{name\}\}/g, firstName)
      .replace(/\{\{company\}\}/g, target.company || "");

    setMessageBody(bodyText);
    setEmailSubject(subjText);
  };

  // Handle WhatsApp Dispatch
  const handleSendWhatsApp = async (openDirect = false) => {
    if (!target || !target.phone) {
      showToast("This lead does not have a phone number configured.", "error");
      return;
    }
    if (!messageBody.trim()) {
      showToast("Message body cannot be empty.", "error");
      return;
    }

    try {
      setSending(true);
      const res = await apiPost<{
        success: boolean;
        communication: LeadCommunication;
        waMeUrl: string;
        provider: string;
      }>("/crm/omnichannel/send-whatsapp", {
        leadId: target.type === "LEAD" ? target.id : null,
        dealId: target.type === "DEAL" ? target.id : null,
        recipientPhone: target.phone,
        body: messageBody.trim(),
        templateName: selectedTemplateId || null,
      });

      if (res.success) {
        if (openDirect && res.waMeUrl) {
          window.open(res.waMeUrl, "_blank");
        }
        showToast("WhatsApp message logged & dispatched!", "success");
        setMessageBody("");
        setSelectedTemplateId("");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send WhatsApp message", "error");
    } finally {
      setSending(false);
    }
  };

  // Handle Email Dispatch
  const handleSendEmail = async () => {
    if (!target || !target.email) {
      showToast("This lead does not have an email address configured.", "error");
      return;
    }
    if (!messageBody.trim()) {
      showToast("Email body cannot be empty.", "error");
      return;
    }

    try {
      setSending(true);
      const res = await apiPost<{
        success: boolean;
        communication: LeadCommunication;
      }>("/crm/omnichannel/send-email", {
        leadId: target.type === "LEAD" ? target.id : null,
        dealId: target.type === "DEAL" ? target.id : null,
        recipientEmail: target.email,
        subject: emailSubject.trim() || `Planitt Solutions Update for ${target.name}`,
        body: messageBody.trim(),
        templateName: selectedTemplateId || null,
      });

      if (res.success) {
        showToast("Email successfully dispatched!", "success");
        setMessageBody("");
        setEmailSubject("");
        setSelectedTemplateId("");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send email", "error");
    } finally {
      setSending(false);
    }
  };

  // Handle Open in Gmail Web
  const handleOpenInGmail = async () => {
    if (!target || !target.email) {
      showToast("This lead does not have an email address configured.", "error");
      return;
    }
    const subj = emailSubject.trim() || `Planitt Solutions Update for ${target.name}`;
    const body = messageBody.trim();
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(target.email)}&su=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, "_blank");

    try {
      await apiPost("/crm/omnichannel/send-email", {
        leadId: target.type === "LEAD" ? target.id : null,
        dealId: target.type === "DEAL" ? target.id : null,
        recipientEmail: target.email,
        subject: subj,
        body: body || "(Opened in Gmail compose window)",
        templateName: selectedTemplateId || "custom_gmail",
      });
      showToast("Opened in Gmail & logged to timeline!", "success");
    } catch {
      // Logged
    }
  };

  if (!isOpen || !target) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-[var(--surface-strong,#ffffff)] shadow-2xl border-l border-[var(--border)] overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 bg-[var(--surface-soft)]">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={target.name} size="md" status="AVAILABLE" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--text-main)] truncate">{target.name}</h3>
                <span className="rounded-md bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--accent)] border border-[var(--accent)]/20">
                  {target.type}: {target.statusOrStage || "ACTIVE"}
                </span>
              </div>
              <p className="text-xs text-[var(--text-soft)] truncate">
                {target.company ? `${target.company} · ` : ""}
                {target.phone || "No phone"} · {target.email || "No email"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--surface-strong,#ffffff)] hover:text-[var(--text-main)] transition"
          >
            ✕
          </button>
        </div>

        {/* Channel Switcher Tabs */}
        <div className="flex border-b border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-5">
          <button
            type="button"
            onClick={() => setActiveChannel("WHATSAPP")}
            className={`flex items-center gap-2 border-b-2 py-3 text-xs font-bold transition ${
              activeChannel === "WHATSAPP"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-[var(--text-soft)] hover:text-[var(--text-main)]"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[11px] font-black">
              💬
            </span>
            <span>WhatsApp Conversation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveChannel("EMAIL")}
            className={`ml-6 flex items-center gap-2 border-b-2 py-3 text-xs font-bold transition ${
              activeChannel === "EMAIL"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-[var(--text-soft)] hover:text-[var(--text-main)]"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white text-[11px] font-black">
              ✉️
            </span>
            <span>Email Messages</span>
          </button>
        </div>

        {/* Middle: Conversation Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[var(--app-bg)]/40">
          {loading ? (
            <p className="py-12 text-center text-xs text-[var(--text-soft)]">Loading conversations…</p>
          ) : communications.length === 0 ? (
            <div className="py-12 text-center">
              <span className="text-3xl">💬</span>
              <p className="mt-2 text-sm font-bold text-[var(--text-main)]">No messages yet</p>
              <p className="text-xs text-[var(--text-soft)] mt-0.5">
                Start a WhatsApp chat or send an official proposal email below.
              </p>
            </div>
          ) : (
            communications
              .filter((c) => (activeChannel === "WHATSAPP" ? c.channel === "WHATSAPP" : c.channel === "EMAIL"))
              .map((comm) => {
                const isOut = comm.direction === "OUTBOUND";
                return (
                  <div
                    key={comm.id}
                    className={`flex flex-col ${isOut ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-2xs leading-relaxed ${
                        isOut
                          ? comm.channel === "WHATSAPP"
                            ? "bg-emerald-50 text-emerald-950 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800"
                            : "bg-blue-50 text-blue-950 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800"
                          : "bg-[var(--surface-strong,#ffffff)] text-[var(--text-main)] border border-[var(--border)]"
                      }`}
                    >
                      {comm.subject && (
                        <p className="font-bold border-b pb-1 mb-1 border-current/20">
                          {comm.subject}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{comm.body}</p>

                      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] opacity-75 border-t pt-1 border-current/15">
                        <span>
                          {comm.channel === "WHATSAPP" ? "WhatsApp" : "Email"} ·{" "}
                          {new Date(comm.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="font-semibold uppercase tracking-wider">{comm.status}</span>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* Bottom: Template Selector & Message Composer */}
        <div className="border-t border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-4 space-y-3">
          {/* Quick Sales Templates Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                Planitt Sales & Advisory Templates
              </span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => applyTemplate(tmpl)}
                  className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                    selectedTemplateId === tmpl.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-soft)] hover:border-[var(--accent)] hover:text-[var(--text-main)]"
                  }`}
                >
                  {tmpl.name}
                </button>
              ))}
            </div>
          </div>

          {/* Email Subject Line (if activeChannel === "EMAIL") */}
          {activeChannel === "EMAIL" && (
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Subject (e.g., Planitt Solutions Wealth Consultation)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-strong,#ffffff)] transition"
            />
          )}

          {/* Message Textarea */}
          <textarea
            rows={4}
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder={
              activeChannel === "WHATSAPP"
                ? "Type WhatsApp message or select a Planitt sales template..."
                : "Type email message body..."
            }
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)] focus:bg-[var(--surface-strong,#ffffff)] resize-none transition"
          />

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-[var(--text-soft)] truncate">
              {activeChannel === "WHATSAPP"
                ? target.phone ? `To: ${target.phone}` : "⚠️ No phone added"
                : target.email ? `To: ${target.email}` : "⚠️ No email added"}
            </span>

            <div className="flex items-center gap-2">
              {activeChannel === "WHATSAPP" ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSendWhatsApp(true)}
                    disabled={sending || !target.phone}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition shadow-2xs disabled:opacity-50"
                    title="Opens WhatsApp Web or Desktop App with pre-filled message"
                  >
                    <span>Open in App</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendWhatsApp(false)}
                    disabled={sending || !target.phone}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-xs disabled:opacity-50"
                  >
                    <span>{sending ? "Sending..." : "Send WhatsApp"}</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleOpenInGmail}
                    disabled={sending || !target.email}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 dark:border-blue-800 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 transition shadow-2xs disabled:opacity-50"
                    title="Opens Gmail web composer with pre-filled lead details"
                  >
                    <span>Open in Gmail</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendEmail}
                    disabled={sending || !target.email}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-xs disabled:opacity-50"
                  >
                    <span>{sending ? "Sending..." : "Send Email"}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
