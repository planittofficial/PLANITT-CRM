"use client";

import { useEffect, useState, useMemo } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { useSession } from "@/hooks/use-session";
import { renderSessionGate } from "@/components/shared/session-gate";
import { CrmSkeleton } from "@/components/shared/skeleton";
import { OmnichannelDrawer } from "@/components/crm/omnichannel-drawer";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { showToast } from "@/hooks/use-toast";
import {
  TrendingUpIcon,
  DollarSignIcon,
  UsersIcon,
  PlusIcon,
  SearchIcon,
  FilterIcon,
  CheckIcon,
  ChevronRightIcon,
  SparklesIcon,
} from "@/components/ui/icons";
import type { Lead, Deal, Contact, CrmSummary, CRMUser, Project, DealStage, LeadStatus } from "@/types/crm";

const DEAL_STAGES: { id: DealStage; label: string; color: string }[] = [
  { id: "LEAD", label: "Lead In", color: "border-slate-300 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/30" },
  { id: "CONTACTED", label: "Contacted", color: "border-blue-300 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20" },
  { id: "PROPOSAL", label: "Proposal", color: "border-purple-300 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20" },
  { id: "NEGOTIATION", label: "Negotiation", color: "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20" },
  { id: "WON", label: "Closed Won 🎉", color: "border-emerald-400 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30" },
  { id: "LOST", label: "Closed Lost", color: "border-rose-300 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/20" },
];

export default function CrmPage() {
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession();
  const [activeTab, setActiveTab] = useState<"pipeline" | "leads" | "contacts">("pipeline");
  const [mobileStageFilter, setMobileStageFilter] = useState<DealStage | "ALL">("ALL");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [summary, setSummary] = useState<CrmSummary | null>(null);
  const [allUsers, setAllUsers] = useState<CRMUser[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [omnichannelTarget, setOmnichannelTarget] = useState<{
    type: "LEAD" | "DEAL";
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    value?: number | null;
    statusOrStage?: string;
  } | null>(null);

  // Forms
  const [dealForm, setDealForm] = useState({
    title: "",
    value: "",
    stage: "LEAD" as DealStage,
    leadId: "",
    projectId: "",
    notes: "",
  });

  const [leadForm, setLeadForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    value: "",
    source: "WEBSITE",
    notes: "",
  });

  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    designation: "",
    notes: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [leadsRes, dealsRes, contactsRes, summaryRes] = await Promise.all([
        apiGet<Lead[]>("/crm/leads"),
        apiGet<Deal[]>("/crm/deals"),
        apiGet<Contact[]>("/crm/contacts"),
        apiGet<CrmSummary>("/crm/summary"),
      ]);
      setLeads(leadsRes);
      setDeals(dealsRes);
      setContacts(contactsRes);
      setSummary(summaryRes);
    } catch (err) {
      showToast("Failed to load CRM pipeline data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
      apiGet<CRMUser[]>("/users").then(setAllUsers).catch(() => {});
      apiGet<Project[]>("/projects").then(setAllProjects).catch(() => {});
    }
  }, [user]);

  const handleStageChange = async (dealId: string, newStage: DealStage) => {
    try {
      const updated = await apiPut<Deal>(`/crm/deals/${dealId}`, { stage: newStage });
      setDeals((prev) => prev.map((d) => (d.id === dealId ? updated : d)));
      showToast(`Deal moved to ${newStage}`, "success");
      apiGet<CrmSummary>("/crm/summary").then(setSummary).catch(() => {});
    } catch (err) {
      showToast("Failed to update deal stage", "error");
    }
  };

  const handleCreateDealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealForm.title.trim()) return;

    try {
      const newDeal = await apiPost<Deal>("/crm/deals", {
        title: dealForm.title.trim(),
        value: Number(dealForm.value) || 0,
        stage: dealForm.stage,
        leadId: dealForm.leadId || null,
        projectId: dealForm.projectId || null,
        notes: dealForm.notes.trim() || null,
      });
      setDeals((prev) => [newDeal, ...prev]);
      setCreateDealOpen(false);
      setDealForm({ title: "", value: "", stage: "LEAD", leadId: "", projectId: "", notes: "" });
      showToast("Deal added to pipeline!", "success");
      apiGet<CrmSummary>("/crm/summary").then(setSummary).catch(() => {});
    } catch (err) {
      showToast("Failed to create deal", "error");
    }
  };

  const handleCreateLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.name.trim()) return;

    try {
      const newLead = await apiPost<Lead>("/crm/leads", {
        name: leadForm.name.trim(),
        company: leadForm.company.trim() || null,
        email: leadForm.email.trim() || null,
        phone: leadForm.phone.trim() || null,
        value: Number(leadForm.value) || 0,
        source: leadForm.source,
        notes: leadForm.notes.trim() || null,
      });
      setLeads((prev) => [newLead, ...prev]);
      setCreateLeadOpen(false);
      setLeadForm({ name: "", company: "", email: "", phone: "", value: "", source: "WEBSITE", notes: "" });
      showToast("New Lead added!", "success");
      apiGet<CrmSummary>("/crm/summary").then(setSummary).catch(() => {});
    } catch (err) {
      showToast("Failed to create lead", "error");
    }
  };

  const handleConvertLead = async (lead: Lead) => {
    try {
      const res = await apiPost<{ deal: Deal; contact: Contact }>(`/crm/leads/${lead.id}/convert`, {
        dealTitle: `${lead.name} Deal`,
        dealValue: lead.value || 0,
        stage: "QUALIFIED",
      });
      showToast(`Lead converted to Deal & Contact!`, "success");
      fetchData();
    } catch (err) {
      showToast("Failed to convert lead", "error");
    }
  };

  const handleCreateContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim()) return;

    try {
      const newContact = await apiPost<Contact>("/crm/contacts", {
        name: contactForm.name.trim(),
        company: contactForm.company.trim() || null,
        email: contactForm.email.trim() || null,
        phone: contactForm.phone.trim() || null,
        designation: contactForm.designation.trim() || null,
        notes: contactForm.notes.trim() || null,
      });
      setContacts((prev) => [newContact, ...prev]);
      setCreateContactOpen(false);
      setContactForm({ name: "", email: "", phone: "", company: "", designation: "", notes: "" });
      showToast("Contact added!", "success");
      apiGet<CrmSummary>("/crm/summary").then(setSummary).catch(() => {});
    } catch (err) {
      showToast("Failed to create contact", "error");
    }
  };

  if (sessionLoading || sessionError || !user) {
    return renderSessionGate({ loading: sessionLoading, user, error: sessionError, retry: retrySession });
  }

  if (loading) {
    return (
      <CRMShell user={user} fullBleed>
        <CrmSkeleton />
      </CRMShell>
    );
  }

  return (
    <CRMShell user={user} fullBleed>
      <div className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-[var(--app-bg)]">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-strong,#ffffff)] px-3.5 py-3 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <TrendingUpIcon size={18} className="sm:hidden" />
              <TrendingUpIcon size={20} className="hidden sm:block" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-[var(--text-main)] truncate">CRM Sales Pipeline & Deals</h1>
              <p className="text-[11px] sm:text-xs text-[var(--text-soft)] line-clamp-1 sm:line-clamp-none">
                Manage revenue pipeline, qualify leads, and close high-value client deals
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab === "pipeline" && (
              <button
                type="button"
                onClick={() => setCreateDealOpen(true)}
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-[var(--accent)] px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 transition shrink-0"
              >
                <PlusIcon size={14} />
                <span className="hidden sm:inline">New Deal</span>
                <span className="sm:hidden">Deal</span>
              </button>
            )}

            {activeTab === "leads" && (
              <button
                type="button"
                onClick={() => setCreateLeadOpen(true)}
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-blue-600 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition shrink-0"
              >
                <PlusIcon size={14} />
                <span className="hidden sm:inline">Add Lead</span>
                <span className="sm:hidden">Lead</span>
              </button>
            )}

            {activeTab === "contacts" && (
              <button
                type="button"
                onClick={() => setCreateContactOpen(true)}
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-purple-600 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition shrink-0"
              >
                <PlusIcon size={14} />
                <span className="hidden sm:inline">Add Contact</span>
                <span className="sm:hidden">Contact</span>
              </button>
            )}
          </div>
        </div>

        {/* Pipeline KPI Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 border-b border-[var(--border)] bg-[var(--surface-soft)] p-2.5 sm:p-4 shrink-0">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-2.5 sm:p-3">
              <span className="text-[10px] sm:text-[11px] font-semibold text-[var(--text-soft)]">Pipeline Value</span>
              <p className="text-sm sm:text-base font-black text-blue-600 mt-0.5 truncate">
                ₹{summary.totalPipelineValue.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-2.5 sm:p-3">
              <span className="text-[10px] sm:text-[11px] font-semibold text-[var(--text-soft)]">Won Revenue</span>
              <p className="text-sm sm:text-base font-black text-emerald-600 mt-0.5 truncate">
                ₹{summary.wonValue.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-2.5 sm:p-3">
              <span className="text-[10px] sm:text-[11px] font-semibold text-[var(--text-soft)]">Active Deals</span>
              <p className="text-sm sm:text-base font-black text-[var(--text-main)] mt-0.5">{summary.totalDeals}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-2.5 sm:p-3">
              <span className="text-[10px] sm:text-[11px] font-semibold text-[var(--text-soft)]">Total Leads</span>
              <p className="text-sm sm:text-base font-black text-purple-600 mt-0.5">{summary.totalLeads}</p>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-[var(--border)] bg-[var(--surface-soft)] px-3 sm:px-6 overflow-x-auto no-scrollbar scrollbar-none shrink-0 gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("pipeline")}
            className={`whitespace-nowrap shrink-0 border-b-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "pipeline"
                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface-strong,#ffffff)]"
                : "border-transparent text-[var(--text-soft)] hover:text-[var(--text-main)]"
            }`}
          >
            <span>Deals Pipeline</span>
            <span className="rounded-full bg-[var(--surface-soft)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-bold">
              {deals.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("leads")}
            className={`whitespace-nowrap shrink-0 border-b-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "leads"
                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface-strong,#ffffff)]"
                : "border-transparent text-[var(--text-soft)] hover:text-[var(--text-main)]"
            }`}
          >
            <span>Leads</span>
            <span className="rounded-full bg-[var(--surface-soft)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-bold">
              {leads.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("contacts")}
            className={`whitespace-nowrap shrink-0 border-b-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "contacts"
                ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface-strong,#ffffff)]"
                : "border-transparent text-[var(--text-soft)] hover:text-[var(--text-main)]"
            }`}
          >
            <span>Contacts</span>
            <span className="rounded-full bg-[var(--surface-soft)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-bold">
              {contacts.length}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
          {/* ── KANBAN PIPELINE ────────────────────────────────────────── */}
          {activeTab === "pipeline" && (
            <div className="flex flex-col h-full min-h-0">
              {/* Mobile Stage Selector Pill Strip */}
              <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none pb-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileStageFilter("ALL")}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold transition whitespace-nowrap shrink-0 border ${
                    mobileStageFilter === "ALL"
                      ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs"
                      : "bg-[var(--surface-strong,#ffffff)] text-[var(--text-soft)] border-[var(--border)]"
                  }`}
                >
                  All ({deals.length})
                </button>
                {DEAL_STAGES.map((s) => {
                  const count = deals.filter((d) => d.stage === s.id).length;
                  const isSelected = mobileStageFilter === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setMobileStageFilter(s.id)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition whitespace-nowrap shrink-0 border ${
                        isSelected
                          ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs"
                          : "bg-[var(--surface-strong,#ffffff)] text-[var(--text-soft)] border-[var(--border)]"
                      }`}
                    >
                      {s.label.replace(" 🎉", "")} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Kanban Columns */}
              <div
                className={`flex items-start flex-1 min-h-0 gap-3 sm:gap-4 ${
                  mobileStageFilter === "ALL"
                    ? "overflow-x-auto snap-x snap-mandatory sm:snap-none"
                    : "overflow-x-hidden sm:overflow-x-auto"
                } sm:min-w-[1100px] pb-2`}
              >
                {DEAL_STAGES.map((col) => {
                  const stageDeals = deals.filter((d) => d.stage === col.id);
                  const colValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);

                  return (
                    <div
                      key={col.id}
                      className={`flex flex-col ${
                        mobileStageFilter === "ALL"
                          ? "w-[85vw] max-w-sm sm:w-64 shrink-0 snap-center sm:snap-align-none"
                          : mobileStageFilter === col.id
                          ? "w-full sm:w-64 sm:shrink-0"
                          : "hidden sm:flex sm:w-64 sm:shrink-0"
                      } rounded-2xl border ${col.color} p-3 max-h-full overflow-hidden`}
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] shrink-0">
                        <div>
                          <span className="text-xs font-bold text-[var(--text-main)]">{col.label}</span>
                          <p className="text-[10px] text-[var(--text-soft)]">₹{colValue.toLocaleString()}</p>
                        </div>
                        <span className="rounded-full bg-[var(--surface-strong,#ffffff)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold">
                          {stageDeals.length}
                        </span>
                      </div>

                      {/* Cards */}
                      <div className="mt-2 space-y-2.5 overflow-y-auto pr-1">
                        {stageDeals.length === 0 ? (
                          <p className="py-6 text-center text-[11px] text-[var(--text-soft)] italic">
                            No deals in this stage
                          </p>
                        ) : (
                          stageDeals.map((deal) => (
                            <div
                              key={deal.id}
                              className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3 shadow-2xs hover:shadow-xs transition"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-xs font-bold text-[var(--text-main)] line-clamp-1">{deal.title}</h4>
                                <span className="shrink-0 rounded-md bg-[var(--surface-soft)] border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--text-soft)] font-semibold">
                                  {deal.probability}%
                                </span>
                              </div>
                              <p className="text-sm font-black text-blue-600 mt-1">
                                ₹{(deal.value || 0).toLocaleString()}
                              </p>

                              {deal.lead && (
                                <p className="text-[11px] text-[var(--text-soft)] mt-0.5 truncate">
                                  {deal.lead.company || deal.lead.name}
                                </p>
                              )}

                              {/* Quick Omnichannel Trigger */}
                              <div className="mt-2.5 flex items-center justify-between gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOmnichannelTarget({
                                      type: "DEAL",
                                      id: deal.id,
                                      name: deal.title,
                                      email: deal.contact?.email || deal.lead?.email,
                                      phone: deal.contact?.phone || deal.lead?.phone,
                                      company: deal.contact?.company || deal.lead?.company,
                                      value: deal.value,
                                      statusOrStage: deal.stage,
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 transition whitespace-nowrap shrink-0"
                                  title="Open WhatsApp and Email Inbox for this deal"
                                >
                                  <span>💬 WhatsApp · ✉️ Email</span>
                                </button>
                              </div>

                              {/* Stage action buttons */}
                              <div className="mt-3 pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2 text-[11px]">
                                {col.id !== "WON" ? (
                                  <button
                                    type="button"
                                    onClick={() => handleStageChange(deal.id, "WON")}
                                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 text-[11px]"
                                  >
                                    Mark Won 🎉
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-emerald-600 font-bold shrink-0">Closed Won</span>
                                )}
                                <select
                                  value={deal.stage}
                                  onChange={(e) => handleStageChange(deal.id, e.target.value as DealStage)}
                                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] text-[11px] text-[var(--text-main)] px-2 py-1 outline-none shrink-0 max-w-[125px]"
                                >
                                  {DEAL_STAGES.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── LEADS TABLE & MOBILE CARDS ─────────────────────────────── */}
          {activeTab === "leads" && (
            <div className="space-y-3">
              {/* Mobile Cards (sm:hidden) */}
              <div className="space-y-2.5 sm:hidden">
                {leads.length === 0 ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-6 text-center text-xs text-[var(--text-soft)]">
                    No leads found. Capture your first lead above.
                  </div>
                ) : (
                  leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3.5 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-[var(--text-main)] truncate">{lead.name}</h3>
                          {lead.company && (
                            <p className="text-xs text-[var(--text-soft)] mt-0.5 truncate">{lead.company}</p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 text-[10px] font-bold">
                          {lead.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--border)]">
                        <div>
                          <span className="text-[10px] text-[var(--text-soft)]">Est. Value</span>
                          <p className="font-bold text-emerald-600">₹{(lead.value || 0).toLocaleString()}</p>
                        </div>
                        {(lead.phone || lead.email) && (
                          <div className="text-right max-w-[55%]">
                            <span className="text-[10px] text-[var(--text-soft)]">Contact</span>
                            <p className="text-xs text-[var(--text-main)] truncate">{lead.phone || lead.email}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
                        <button
                          type="button"
                          onClick={() =>
                            setOmnichannelTarget({
                              type: "LEAD",
                              id: lead.id,
                              name: lead.name,
                              email: lead.email,
                              phone: lead.phone,
                              company: lead.company,
                              value: lead.value,
                              statusOrStage: lead.status,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition whitespace-nowrap"
                        >
                          <span>💬 WhatsApp · ✉️</span>
                        </button>

                        {lead.status !== "CONVERTED" && (
                          <button
                            type="button"
                            onClick={() => handleConvertLead(lead)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[11px] font-bold text-white hover:opacity-90 transition whitespace-nowrap"
                          >
                            <span>Convert to Deal</span>
                            <ChevronRightIcon size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table (hidden sm:block) */}
              <div className="hidden sm:block rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] shadow-2xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--border)] bg-[var(--surface-soft)] font-bold text-[var(--text-soft)] uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Lead Name</th>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Est. Value</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-[var(--surface-soft)] transition">
                        <td className="px-4 py-3 font-semibold text-[var(--text-main)]">{lead.name}</td>
                        <td className="px-4 py-3 text-[var(--text-soft)]">{lead.company || "-"}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 text-[10px] font-bold">
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-600">
                          ₹{(lead.value || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-soft)]">{lead.phone || lead.email || "-"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setOmnichannelTarget({
                                  type: "LEAD",
                                  id: lead.id,
                                  name: lead.name,
                                  email: lead.email,
                                  phone: lead.phone,
                                  company: lead.company,
                                  value: lead.value,
                                  statusOrStage: lead.status,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition whitespace-nowrap"
                              title="Open WhatsApp & Email Inbox"
                            >
                              <span>💬 WhatsApp · ✉️ Email</span>
                            </button>

                            {lead.status !== "CONVERTED" && (
                              <button
                                type="button"
                                onClick={() => handleConvertLead(lead)}
                                className="inline-flex items-center gap-1 rounded-lg bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90 whitespace-nowrap"
                              >
                                <span>Convert to Deal</span>
                                <ChevronRightIcon size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── CONTACTS TABLE & MOBILE CARDS ──────────────────────────── */}
          {activeTab === "contacts" && (
            <div className="space-y-3">
              {/* Mobile Cards (sm:hidden) */}
              <div className="space-y-2.5 sm:hidden">
                {contacts.length === 0 ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-6 text-center text-xs text-[var(--text-soft)]">
                    No customer contacts registered yet.
                  </div>
                ) : (
                  contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-3.5 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-[var(--text-main)] truncate">{contact.name}</h3>
                          {contact.designation && (
                            <p className="text-xs text-[var(--text-soft)] mt-0.5 truncate">{contact.designation}</p>
                          )}
                        </div>
                        {contact.deals?.length ? (
                          <span className="shrink-0 rounded-md bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 text-[10px] font-bold">
                            {contact.deals.length} deals
                          </span>
                        ) : null}
                      </div>

                      <div className="space-y-1 text-xs pt-1 border-t border-[var(--border)] text-[var(--text-soft)]">
                        {contact.company && (
                          <p className="truncate">
                            <span className="text-[10px] font-semibold text-[var(--text-soft)]">Company: </span>
                            <span className="text-[var(--text-main)]">{contact.company}</span>
                          </p>
                        )}
                        {contact.email && (
                          <p className="truncate">
                            <span className="text-[10px] font-semibold text-[var(--text-soft)]">Email: </span>
                            <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                              {contact.email}
                            </a>
                          </p>
                        )}
                        {contact.phone && (
                          <p className="truncate">
                            <span className="text-[10px] font-semibold text-[var(--text-soft)]">Phone: </span>
                            <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
                              {contact.phone}
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table (hidden sm:block) */}
              <div className="hidden sm:block rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] shadow-2xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--border)] bg-[var(--surface-soft)] font-bold text-[var(--text-soft)] uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Contact Person</th>
                      <th className="px-4 py-3">Company & Role</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Linked Deals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {contacts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-[var(--text-soft)]">
                          No customer contacts registered yet.
                        </td>
                      </tr>
                    ) : (
                      contacts.map((contact) => (
                        <tr key={contact.id} className="hover:bg-[var(--surface-soft)] transition">
                          <td className="px-4 py-3 font-semibold text-[var(--text-main)]">{contact.name}</td>
                          <td className="px-4 py-3 text-[var(--text-soft)]">
                            {contact.company || "-"} {contact.designation ? `(${contact.designation})` : ""}
                          </td>
                          <td className="px-4 py-3 text-[var(--text-main)]">{contact.email || "-"}</td>
                          <td className="px-4 py-3 text-[var(--text-soft)]">{contact.phone || "-"}</td>
                          <td className="px-4 py-3 font-medium">
                            {contact.deals?.length ? `${contact.deals.length} deals` : "None"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Create Deal Modal */}
        {createDealOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
            <div className="w-full max-w-md mx-auto max-h-[90dvh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h2 className="text-base font-bold text-[var(--text-main)]">Add New Deal to Pipeline</h2>
                <button
                  type="button"
                  onClick={() => setCreateDealOpen(false)}
                  className="rounded-lg p-1 text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateDealSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Deal Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Reliance Cloud Modernization"
                    value={dealForm.title}
                    onChange={(e) => setDealForm((f) => ({ ...f, title: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Deal Value (₹) *</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 500000"
                      value={dealForm.value}
                      onChange={(e) => setDealForm((f) => ({ ...f, value: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Initial Stage</label>
                    <select
                      value={dealForm.stage}
                      onChange={(e) => setDealForm((f) => ({ ...f, stage: e.target.value as DealStage }))}
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2 text-xs text-[var(--text-main)] outline-none"
                    >
                      {DEAL_STAGES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Key client requirements, next steps..."
                    value={dealForm.notes}
                    onChange={(e) => setDealForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2.5 text-xs text-[var(--text-main)] outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setCreateDealOpen(false)}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-soft)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90"
                  >
                    Add Deal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Lead Modal */}
        {createLeadOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
            <div className="w-full max-w-md mx-auto max-h-[90dvh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h2 className="text-base font-bold text-[var(--text-main)]">Capture New Lead</h2>
                <button
                  type="button"
                  onClick={() => setCreateLeadOpen(false)}
                  className="rounded-lg p-1 text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateLeadSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Lead Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={leadForm.name}
                    onChange={(e) => setLeadForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Company</label>
                    <input
                      type="text"
                      placeholder="e.g. Tata Steel"
                      value={leadForm.company}
                      onChange={(e) => setLeadForm((f) => ({ ...f, company: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Estimated Value (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 200000"
                      value={leadForm.value}
                      onChange={(e) => setLeadForm((f) => ({ ...f, value: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="client@company.com"
                      value={leadForm.email}
                      onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Phone</label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={leadForm.phone}
                      onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setCreateLeadOpen(false)}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-soft)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                  >
                    Save Lead
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Contact Modal */}
        {createContactOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
            <div className="w-full max-w-md mx-auto max-h-[90dvh] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-5 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h2 className="text-base font-bold text-[var(--text-main)]">Add Customer Contact</h2>
                <button
                  type="button"
                  onClick={() => setCreateContactOpen(false)}
                  className="rounded-lg p-1 text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateContactSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Contact Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma"
                    value={contactForm.name}
                    onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Company</label>
                    <input
                      type="text"
                      placeholder="e.g. Infosys Ltd"
                      value={contactForm.company}
                      onChange={(e) => setContactForm((f) => ({ ...f, company: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Designation / Role</label>
                    <input
                      type="text"
                      placeholder="e.g. VP of Engineering"
                      value={contactForm.designation}
                      onChange={(e) => setContactForm((f) => ({ ...f, designation: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="priya@company.com"
                      value={contactForm.email}
                      onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Phone</label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Key background, preferred communication channels..."
                    value={contactForm.notes}
                    onChange={(e) => setContactForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2.5 text-xs text-[var(--text-main)] outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setCreateContactOpen(false)}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-soft)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-700"
                  >
                    Save Contact
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── OMNICHANNEL WHATSAPP & EMAIL DRAWER ─────────────────────── */}
        <OmnichannelDrawer
          isOpen={Boolean(omnichannelTarget)}
          onClose={() => setOmnichannelTarget(null)}
          target={omnichannelTarget}
          currentUser={user!}
        />
      </div>
    </CRMShell>
  );
}
