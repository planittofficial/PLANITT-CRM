"use client";

import { useMemo, useState } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { StatePanel } from "@/components/shared/state-panel";
import { ResponsiveSelect } from "@/components/shared/responsive-select";
import { ProjectLinkPicker } from "@/components/credentials/project-link-picker";
import { CredentialFlowGraph } from "@/components/credentials/credential-flow-graph";
import { EnvVariableChip } from "@/components/credentials/credential-summary-header";
import { useCredentialsData } from "@/hooks/use-credentials-data";
import {
  credentialProjectNames,
  looksLikeSecret,
  resolveEnvKeyDisplay,
  searchableCredentialText,
  statusLabel,
  statusTone,
  usageDisplayName,
} from "@/lib/credential-usage";
import type { Credential } from "@/types/crm";

const FIELD_STYLE = { borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" } as const;
const ENV_OPTIONS = ["PROD", "STAGING", "DEV", "LOCAL"].map((x) => ({ value: x, label: x }));

type FilterKey = "ALL" | "ACTION" | "EXPIRED" | "VALID";
type WorkspaceTab = "analyze" | "manage";

function matchesFilter(credential: Credential, filter: FilterKey) {
  if (filter === "ALL") return true;
  if (filter === "ACTION") return credential.status === "EXPIRED" || credential.status === "EXPIRING_SOON";
  if (filter === "EXPIRED") return credential.status === "EXPIRED";
  if (filter === "VALID") return credential.status === "VALID";
  return true;
}

export default function CredentialsPage() {
  const {
    user,
    saving,
    error,
    sessionGate,
    items,
    projects,
    selectedId,
    setSelectedId,
    selected,
    counts,
    actionRequired,
    createForm,
    setCreateForm,
    createPicker,
    setCreatePicker,
    createPendingLinks,
    setCreatePendingLinks,
    linkDraft,
    setLinkDraft,
    linkPicker,
    setLinkPicker,
    linkPendingLinks,
    setLinkPendingLinks,
    editForm,
    setEditForm,
    linkedProjectIdsForSelected,
    linkedCustomNamesForSelected,
    addCreatePendingLink,
    addLinkPendingLink,
    createCredential,
    saveCredentialEdits,
    rotateCredential,
    deleteCredential,
    linkProjects,
    removeUsage,
  } = useCredentialsData();

  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [search, setSearch] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("analyze");
  const [highlightedUsageId, setHighlightedUsageId] = useState<string | undefined>();
  const [showAddForm, setShowAddForm] = useState(false);

  const envOptions = useMemo(() => ENV_OPTIONS, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((credential) => {
      if (!matchesFilter(credential, filter)) return false;
      if (!query) return true;
      return searchableCredentialText(credential).includes(query);
    });
  }, [items, filter, search]);

  if (sessionGate) return sessionGate;
  if (!user) return null;

  return (
    <CRMShell user={user}>
      <div className="min-h-0 min-w-0 overflow-x-hidden lg:flex lg:h-full lg:flex-col">
        {/* Unified workspace shell */}
        <div
          className="flex h-[min(78dvh,900px)] min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] border lg:h-full lg:min-h-0"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}
        >
          {/* Top bar */}
          <header className="shrink-0 border-b px-4 py-4 sm:px-5" style={{ borderColor: "var(--border)" }}>
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--text-faint)">Credentials</p>
                <h1 className="mt-1 truncate text-xl font-semibold text-(--text-main) sm:text-2xl">API key deployment map</h1>
              </div>
              <div className="flex min-w-0 flex-wrap gap-2">
                {[
                  { label: "Total", value: counts.total, color: "var(--text-main)" },
                  { label: "Expired", value: counts.expired, color: "var(--danger)" },
                  { label: "Expiring", value: counts.expiringSoon, color: "#b45309" },
                  { label: "Unlinked", value: counts.withoutProjects, color: "var(--text-soft)" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border px-3 py-1.5"
                    style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
                  >
                    <span className="text-[10px] uppercase tracking-[0.12em] text-(--text-faint)">{stat.label} </span>
                    <span className="ml-1 text-sm font-bold" style={{ color: stat.color }}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {actionRequired.length > 0 ? (
              <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                {actionRequired.map((credential) => {
                  const tone = statusTone(credential.status);
                  return (
                    <button
                      key={credential.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(credential.id);
                        setWorkspaceTab("analyze");
                        setHighlightedUsageId(undefined);
                      }}
                      className="max-w-full truncate rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                      style={{ borderColor: tone.stroke, background: tone.fill, color: "var(--text-main)" }}
                    >
                      {credential.name} · {statusLabel(credential.status, credential.daysLeft)}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </header>

          {/* Split body */}
          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
            {/* Registry rail */}
            <aside
              className="flex min-h-0 min-w-0 flex-col border-b xl:border-b-0 xl:border-r"
              style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
            >
              <div className="shrink-0 space-y-3 border-b p-4" style={{ borderColor: "var(--border)" }}>
                <input
                  className="h-10 w-full min-w-0 rounded-xl border px-3 text-sm outline-none"
                  style={FIELD_STYLE}
                  placeholder="Search keys or projects..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {(
                    [
                      { key: "ALL", label: "All" },
                      { key: "ACTION", label: "Action" },
                      { key: "EXPIRED", label: "Expired" },
                      { key: "VALID", label: "Valid" },
                    ] as const
                  ).map((chip) => {
                    const active = filter === chip.key;
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => setFilter(chip.key)}
                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={
                          active
                            ? { background: "#0f172a", color: "#fff" }
                            : { background: "var(--surface)", color: "var(--text-soft)" }
                        }
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddForm((v) => !v)}
                  className="h-9 w-full rounded-xl border text-xs font-semibold"
                  style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
                >
                  {showAddForm ? "Close add form" : "+ Add credential"}
                </button>
              </div>

              {showAddForm ? (
                <div className="max-h-[40vh] shrink-0 space-y-2.5 overflow-y-auto overscroll-contain border-b p-4" style={{ borderColor: "var(--border)" }}>
                  <input
                    className="h-10 w-full min-w-0 rounded-xl border px-3 text-sm outline-none"
                    style={FIELD_STYLE}
                    placeholder="Name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((c) => ({ ...c, name: e.target.value }))}
                  />
                  <div className="grid min-w-0 gap-2">
                    <input
                      className="h-10 w-full min-w-0 rounded-xl border px-3 text-sm outline-none"
                      style={FIELD_STYLE}
                      placeholder="Provider"
                      value={createForm.provider}
                      onChange={(e) => setCreateForm((c) => ({ ...c, provider: e.target.value }))}
                    />
                    <input
                      className="h-10 w-full min-w-0 rounded-xl border px-3 text-sm outline-none"
                      style={FIELD_STYLE}
                      placeholder="Env variable name (e.g. MONGODB_URI)"
                      value={createForm.envKey}
                      onChange={(e) => setCreateForm((c) => ({ ...c, envKey: e.target.value }))}
                    />
                  </div>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    <input
                      className="h-10 w-full min-w-0 rounded-xl border px-3 text-sm outline-none"
                      style={FIELD_STYLE}
                      placeholder="Validity days"
                      value={createForm.validityDays}
                      onChange={(e) => setCreateForm((c) => ({ ...c, validityDays: e.target.value }))}
                    />
                    <input
                      type="date"
                      className="h-10 w-full min-w-0 rounded-xl border px-3 text-sm outline-none"
                      style={FIELD_STYLE}
                      value={createForm.expiresAt}
                      onChange={(e) => setCreateForm((c) => ({ ...c, expiresAt: e.target.value }))}
                      aria-label="Expiry date"
                    />
                  </div>
                  <div className="min-w-0">
                    <ProjectLinkPicker
                      projects={projects}
                      mode={createPicker.mode}
                      onModeChange={(mode) => setCreatePicker((current) => ({ ...current, mode }))}
                      selectedProjectId={createPicker.projectId}
                      onSelectedProjectIdChange={(value) => setCreatePicker((current) => ({ ...current, projectId: value }))}
                      customProjectName={createPicker.customName}
                      onCustomProjectNameChange={(value) => setCreatePicker((current) => ({ ...current, customName: value }))}
                      pendingLinks={createPendingLinks}
                      onAdd={addCreatePendingLink}
                      onRemove={(key) => setCreatePendingLinks((current) => current.filter((link) => link.key !== key))}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={saving || !createForm.name.trim()}
                    onClick={() => void createCredential()}
                    className="h-10 w-full rounded-xl text-sm font-semibold text-white disabled:opacity-70"
                    style={{ background: "var(--accent-strong)" }}
                  >
                    {saving ? "Saving..." : "Add credential"}
                  </button>
                </div>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                {filteredItems.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-(--text-soft)">
                    {items.length === 0 ? "No credentials yet." : "No matches."}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {filteredItems.map((credential) => {
                      const sel = credential.id === selectedId;
                      const tone = statusTone(credential.status);
                      const projectCount = (credential.usages ?? []).length;
                      return (
                        <li key={credential.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(credential.id);
                              setHighlightedUsageId(undefined);
                            }}
                            className="flex w-full min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition"
                            style={
                              sel
                                ? {
                                    background: "var(--surface)",
                                    boxShadow: `inset 3px 0 0 ${tone.stroke}`,
                                  }
                                : { background: "transparent" }
                            }
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ background: tone.stroke, boxShadow: tone.pulse ? `0 0 6px ${tone.glow}` : undefined }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-(--text-main)">{credential.name}</p>
                              <p className="truncate text-[11px] text-(--text-soft)">
                                {projectCount} target{projectCount === 1 ? "" : "s"}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] font-bold" style={{ color: tone.text }}>
                              {credential.status === "EXPIRING_SOON" && credential.daysLeft !== null
                                ? `${credential.daysLeft}d`
                                : credential.status === "VALID"
                                  ? "OK"
                                  : credential.status === "EXPIRED"
                                    ? "!"
                                    : "?"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>

            {/* Main workspace */}
            <main className="min-h-0 min-w-0 overflow-y-auto overscroll-contain">
              {!selected ? (
                <div className="flex h-full min-h-[320px] items-center justify-center p-6">
                  <StatePanel
                    title="Select a credential"
                    description={
                      items.length
                        ? "Choose a key from the registry to inspect its deployment pipeline."
                        : "Add your first credential using the button in the left panel."
                    }
                  />
                </div>
              ) : (
                <div className="min-w-0 p-4 sm:p-5">
                  {(() => {
                    const tone = statusTone(selected.status);
                    const deploymentsCount = (selected.usages ?? []).length;
                    return (
                      <div className="min-w-0 overflow-hidden rounded-2xl border" style={{ borderColor: tone.stroke, background: "var(--surface)" }}>
                        <div className="flex min-w-0">
                          <div className="w-1 shrink-0" style={{ background: tone.stroke }} aria-hidden />
                          <div className="min-w-0 flex-1 p-4 sm:p-5">
                            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--text-faint)">Credential</p>
                                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                                  <h2 className="min-w-0 truncate text-xl font-semibold tracking-tight text-(--text-main)">{selected.name}</h2>
                                  <span
                                    className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                                    style={{ background: tone.fill, color: tone.text }}
                                  >
                                    {statusLabel(selected.status, selected.daysLeft)}
                                  </span>
                                </div>
                                <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="text-sm text-(--text-soft)">{selected.provider?.trim() || "Provider not set"}</span>
                                  <span className="text-[11px] text-(--text-faint)">•</span>
                                  <EnvVariableChip value={selected.envKey} credentialName={selected.name} />
                                  <span className="text-[11px] text-(--text-faint)">•</span>
                                  <span className="text-sm text-(--text-soft)">
                                    {deploymentsCount} deployment target{deploymentsCount === 1 ? "" : "s"}
                                  </span>
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <div
                                  className="inline-flex rounded-xl border p-1"
                                  style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
                                >
                                  {(
                                    [
                                      { key: "analyze", label: "Analyze" },
                                      { key: "manage", label: "Manage" },
                                    ] as const
                                  ).map((tab) => (
                                    <button
                                      key={tab.key}
                                      type="button"
                                      onClick={() => setWorkspaceTab(tab.key)}
                                      className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                                      style={
                                        workspaceTab === tab.key
                                          ? { background: "var(--surface)", color: "var(--text-main)", boxShadow: "var(--shadow-soft)" }
                                          : { color: "var(--text-soft)" }
                                      }
                                    >
                                      {tab.label}
                                    </button>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void rotateCredential()}
                                  className="h-9 rounded-xl border px-3 text-xs font-semibold disabled:opacity-70"
                                  style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
                                >
                                  Mark rotated
                                </button>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void deleteCredential(selected.id)}
                                  className="h-9 rounded-xl px-3 text-xs font-semibold text-white disabled:opacity-70"
                                  style={{ background: "var(--danger)" }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                              {workspaceTab === "analyze" ? (
                                <CredentialFlowGraph
                                  credential={selected}
                                  selectedUsageId={highlightedUsageId}
                                  onUsageClick={(usage) => setHighlightedUsageId(usage.id)}
                                />
                              ) : (
                                <div className="min-w-0 space-y-5">
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--text-faint)">Credential settings</p>
                                    {looksLikeSecret(editForm.envKey) ? (
                                      <p
                                        className="mt-2 rounded-xl border px-3 py-2 text-xs text-(--danger)"
                                        style={{
                                          borderColor: "var(--danger)",
                                          background: "color-mix(in srgb, var(--danger) 8%, var(--surface))",
                                        }}
                                      >
                                        The env variable field contains a connection string. Store only the variable name (e.g. DATABASE_URL), not the secret value.
                                      </p>
                                    ) : null}
                                    <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                                      {(
                                        [
                                          { key: "name", label: "Name", value: editForm.name, onChange: (v: string) => setEditForm((c) => ({ ...c, name: v })) },
                                          { key: "provider", label: "Provider", value: editForm.provider, onChange: (v: string) => setEditForm((c) => ({ ...c, provider: v })) },
                                          { key: "envKey", label: "Env variable name", value: editForm.envKey, onChange: (v: string) => setEditForm((c) => ({ ...c, envKey: v })) },
                                          { key: "validityDays", label: "Validity days", value: editForm.validityDays, onChange: (v: string) => setEditForm((c) => ({ ...c, validityDays: v })) },
                                        ] as const
                                      ).map((field) => (
                                        <label key={field.key} className="min-w-0 text-sm font-medium text-(--text-main)">
                                          {field.label}
                                          <input
                                            className="mt-1.5 h-10 w-full min-w-0 rounded-xl border px-3 text-sm outline-none"
                                            style={FIELD_STYLE}
                                            value={field.value}
                                            onChange={(e) => field.onChange(e.target.value)}
                                          />
                                        </label>
                                      ))}
                                      <label className="min-w-0 text-sm font-medium text-(--text-main) sm:col-span-2">
                                        Expires on
                                        <input
                                          type="date"
                                          className="mt-1.5 h-10 w-full min-w-0 rounded-xl border px-3 text-sm outline-none"
                                          style={FIELD_STYLE}
                                          value={editForm.expiresAt}
                                          onChange={(e) => setEditForm((c) => ({ ...c, expiresAt: e.target.value }))}
                                        />
                                      </label>
                                    </div>
                                    <label className="mt-3 block min-w-0 text-sm font-medium text-(--text-main)">
                                      Notes
                                      <textarea
                                        className="mt-1.5 min-h-20 w-full min-w-0 rounded-xl border px-3 py-2 text-sm outline-none"
                                        style={FIELD_STYLE}
                                        value={editForm.notes}
                                        onChange={(e) => setEditForm((c) => ({ ...c, notes: e.target.value }))}
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={() => void saveCredentialEdits()}
                                      className="mt-4 h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-70"
                                      style={{ background: "var(--accent-strong)" }}
                                    >
                                      {saving ? "Saving..." : "Save changes"}
                                    </button>
                                  </div>

                                  <div className="border-t pt-5" style={{ borderColor: "var(--border)" }}>
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--text-faint)">Project links</p>
                                    <p className="mt-1 text-sm text-(--text-soft)">
                                      Add projects (or unlisted repos) as deployment targets for this credential.
                                    </p>
                                    {projects.length === 0 ? (
                                      <p
                                        className="mt-2 rounded-xl border px-3 py-2 text-xs text-(--text-soft)"
                                        style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
                                      >
                                        No CRM projects found. Create projects first, or use &quot;New / unlisted project&quot;.
                                      </p>
                                    ) : null}

                                    {(selected.usages ?? []).length > 0 ? (
                                      <ul className="mt-3 space-y-2">
                                        {selected.usages.map((usage) => (
                                          <li
                                            key={usage.id}
                                            className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5"
                                            style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
                                          >
                                            <div className="min-w-0 flex-1">
                                              <p className="truncate text-sm font-semibold text-(--text-main)">{usageDisplayName(usage)}</p>
                                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                                <span
                                                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                                                  style={{
                                                    background: "var(--surface)",
                                                    color: "var(--text-soft)",
                                                    border: "1px solid var(--border)",
                                                  }}
                                                >
                                                  {usage.environment ?? "ALL"}
                                                </span>
                                                <EnvVariableChip value={usage.envKey ?? selected.envKey} credentialName={selected.name} />
                                              </div>
                                            </div>
                                            <button
                                              type="button"
                                              disabled={saving}
                                              onClick={() => void removeUsage(selected.id, usage.id)}
                                              className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-70"
                                              style={{ background: "var(--danger)" }}
                                            >
                                              Remove
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : null}

                                    <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                                      <label className="min-w-0 text-sm font-medium text-(--text-main)">
                                        Environment
                                        <div className="mt-1.5 min-w-0">
                                          <ResponsiveSelect
                                            value={linkDraft.environment}
                                            onChange={(value) => setLinkDraft((c) => ({ ...c, environment: value }))}
                                            options={envOptions}
                                            ariaLabel="Select environment"
                                            buttonClassName="h-10 px-3 w-full"
                                          />
                                        </div>
                                      </label>
                                      <label className="min-w-0 text-sm font-medium text-(--text-main)">
                                        Env variable override
                                        <input
                                          className="mt-1.5 h-10 w-full min-w-0 rounded-xl border px-3 text-sm outline-none"
                                          style={FIELD_STYLE}
                                          placeholder={resolveEnvKeyDisplay(selected.envKey, selected.name).label}
                                          value={linkDraft.envKey}
                                          onChange={(e) => setLinkDraft((c) => ({ ...c, envKey: e.target.value }))}
                                        />
                                        <p className="mt-1 text-[11px] text-(--text-faint)">
                                          Optional. Use the env variable name only (e.g. DATABASE_URL), not the secret value.
                                        </p>
                                        {looksLikeSecret(linkDraft.envKey) ? (
                                          <p className="mt-1 text-[11px] font-semibold text-(--danger)">
                                            Do not paste connection strings here — use the variable name only.
                                          </p>
                                        ) : null}
                                      </label>
                                    </div>

                                    <div className="mt-4 min-w-0">
                                      <ProjectLinkPicker
                                        projects={projects}
                                        mode={linkPicker.mode}
                                        onModeChange={(mode) => setLinkPicker((current) => ({ ...current, mode }))}
                                        selectedProjectId={linkPicker.projectId}
                                        onSelectedProjectIdChange={(value) => setLinkPicker((current) => ({ ...current, projectId: value }))}
                                        customProjectName={linkPicker.customName}
                                        onCustomProjectNameChange={(value) => setLinkPicker((current) => ({ ...current, customName: value }))}
                                        pendingLinks={linkPendingLinks}
                                        onAdd={addLinkPendingLink}
                                        onRemove={(key) => setLinkPendingLinks((current) => current.filter((link) => link.key !== key))}
                                        excludedProjectIds={linkedProjectIdsForSelected}
                                        excludedCustomNames={linkedCustomNamesForSelected}
                                      />
                                    </div>

                                    <textarea
                                      className="mt-3 min-h-16 w-full min-w-0 rounded-xl border px-3 py-2 text-sm outline-none"
                                      style={FIELD_STYLE}
                                      placeholder="Notes for new links (optional)"
                                      value={linkDraft.notes}
                                      onChange={(e) => setLinkDraft((c) => ({ ...c, notes: e.target.value }))}
                                    />

                                    <button
                                      type="button"
                                      disabled={saving || linkPendingLinks.length === 0}
                                      onClick={() => void linkProjects(selected.id)}
                                      className="mt-3 h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-70"
                                      style={{ background: "var(--accent-strong)" }}
                                    >
                                      {saving ? "Saving..." : "Link projects"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {error ? (
                    <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--danger)" }}>
                      <StatePanel title="Something went wrong" description={error} />
                    </div>
                  ) : null}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </CRMShell>
  );
}
