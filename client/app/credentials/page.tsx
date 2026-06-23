"use client";

import { useMemo } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { StatePanel } from "@/components/shared/state-panel";
import { ResponsiveSelect } from "@/components/shared/responsive-select";
import { ProjectLinkPicker } from "@/components/credentials/project-link-picker";
import { useCredentialsData } from "@/hooks/use-credentials-data";
import { credentialProjectNames, statusLabel, usageDisplayName } from "@/lib/credential-usage";

const FIELD_STYLE = { borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" } as const;
const ENV_OPTIONS = ["PROD", "STAGING", "DEV", "LOCAL"].map((x) => ({ value: x, label: x }));

function Surface({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-[20px] border p-5"
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}
    >
      {children}
    </section>
  );
}

function statusStyle(status: string) {
  if (status === "EXPIRED") return { bg: "color-mix(in srgb, var(--danger) 16%, var(--surface-soft))", fg: "var(--danger)" };
  if (status === "EXPIRING_SOON") return { bg: "color-mix(in srgb, #f59e0b 16%, var(--surface-soft))", fg: "#b45309" };
  if (status === "VALID") return { bg: "color-mix(in srgb, var(--success) 14%, var(--surface-soft))", fg: "var(--success)" };
  return { bg: "var(--surface-soft)", fg: "var(--text-soft)" };
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

  const envOptions = useMemo(() => ENV_OPTIONS, []);

  if (sessionGate) return sessionGate;
  if (!user) return null;

  return (
    <CRMShell user={user}>
      <div className="min-w-0 space-y-4 overflow-x-hidden pb-4">
        <Surface>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Credentials registry</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]">API keys & project usage map</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
            Register each API key once, link it to multiple projects, and show developers exactly where the same key must be updated when it expires.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Total keys", value: counts.total },
              { label: "Expired", value: counts.expired },
              { label: "Expiring soon", value: counts.expiringSoon },
              { label: "No project links", value: counts.withoutProjects },
              { label: "Unknown expiry", value: counts.unknown },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">{stat.label}</p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-main)]">{stat.value}</p>
              </div>
            ))}
          </div>
        </Surface>

        {actionRequired.length > 0 ? (
          <Surface>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Action required</p>
            <div className="mt-3 space-y-2">
              {actionRequired.map((credential) => (
                <button
                  key={credential.id}
                  type="button"
                  onClick={() => setSelectedId(credential.id)}
                  className="flex w-full flex-col gap-2 rounded-2xl border px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between"
                  style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
                >
                  <div>
                    <p className="font-semibold text-[var(--text-main)]">{credential.name}</p>
                    <p className="mt-1 text-sm text-[var(--text-soft)]">
                      {statusLabel(credential.status, credential.daysLeft)} • update in:{" "}
                      {credentialProjectNames(credential).join(", ") || "no projects linked yet"}
                    </p>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: statusStyle(credential.status).fg }}>
                    {credential.status}
                  </span>
                </button>
              ))}
            </div>
          </Surface>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <Surface>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">All credentials</p>
              <div className="mt-4 space-y-3">
                {items.length === 0 ? (
                  <p className="rounded-2xl border px-4 py-6 text-sm text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>
                    No credentials added yet.
                  </p>
                ) : (
                  items.map((credential) => {
                    const sel = credential.id === selectedId;
                    const badge = statusStyle(credential.status);
                    const projectNames = credentialProjectNames(credential);
                    return (
                      <button
                        key={credential.id}
                        type="button"
                        onClick={() => setSelectedId(credential.id)}
                        className="w-full rounded-2xl border px-4 py-4 text-left transition"
                        style={
                          sel
                            ? { borderColor: "#0f172a", background: "#0f172a", color: "#ffffff" }
                            : { borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{credential.name}</p>
                            <p className={`mt-1 text-xs ${sel ? "text-slate-300" : "text-[var(--text-soft)]"}`}>
                              {credential.provider ?? "Provider not set"}
                              {credential.envKey ? ` • ${credential.envKey}` : ""}
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                            style={{ background: sel ? "rgba(255,255,255,0.14)" : badge.bg, color: sel ? "white" : badge.fg }}
                          >
                            {statusLabel(credential.status, credential.daysLeft)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {projectNames.length ? (
                            projectNames.map((name) => (
                              <span
                                key={name}
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{
                                  background: sel ? "rgba(255,255,255,0.12)" : "var(--surface)",
                                  color: sel ? "white" : "var(--text-soft)",
                                }}
                              >
                                {name}
                              </span>
                            ))
                          ) : (
                            <span className={`text-xs ${sel ? "text-slate-300" : "text-[var(--text-faint)]"}`}>No projects linked</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </Surface>

            <Surface>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Add credential</p>
              <div className="mt-4 grid gap-3">
                <input
                  className="h-11 w-full rounded-2xl border px-4 text-sm outline-none"
                  style={FIELD_STYLE}
                  placeholder="Credential name (e.g. Grok API Key)"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((c) => ({ ...c, name: e.target.value }))}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className="h-11 w-full rounded-2xl border px-4 text-sm outline-none"
                    style={FIELD_STYLE}
                    placeholder="Provider (e.g. Grok)"
                    value={createForm.provider}
                    onChange={(e) => setCreateForm((c) => ({ ...c, provider: e.target.value }))}
                  />
                  <input
                    className="h-11 w-full rounded-2xl border px-4 text-sm outline-none"
                    style={FIELD_STYLE}
                    placeholder="Env key (e.g. GROK_API_KEY)"
                    value={createForm.envKey}
                    onChange={(e) => setCreateForm((c) => ({ ...c, envKey: e.target.value }))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className="h-11 w-full rounded-2xl border px-4 text-sm outline-none"
                    style={FIELD_STYLE}
                    placeholder="Validity days (e.g. 90)"
                    value={createForm.validityDays}
                    onChange={(e) => setCreateForm((c) => ({ ...c, validityDays: e.target.value }))}
                  />
                  <input
                    type="date"
                    className="h-11 w-full rounded-2xl border px-4 text-sm outline-none"
                    style={FIELD_STYLE}
                    value={createForm.expiresAt}
                    onChange={(e) => setCreateForm((c) => ({ ...c, expiresAt: e.target.value }))}
                    aria-label="Expiry date"
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-[var(--text-main)]">Link to projects</p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">
                    Use the dropdown for CRM projects, or switch to custom name if the project is not listed yet. Add multiple projects one by one.
                  </p>
                  <div className="mt-3">
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
                </div>

                <textarea
                  className="min-h-20 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  style={FIELD_STYLE}
                  placeholder="Notes (optional)"
                  value={createForm.notes}
                  onChange={(e) => setCreateForm((c) => ({ ...c, notes: e.target.value }))}
                />
                <button
                  type="button"
                  disabled={saving || !createForm.name.trim()}
                  onClick={() => void createCredential()}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
                  style={{ background: "var(--accent-strong)" }}
                >
                  {saving ? "Saving..." : "Add credential & link projects"}
                </button>
              </div>
            </Surface>
          </aside>

          <section className="space-y-4">
            {!selected ? (
              <Surface>
                <StatePanel title="No credential selected" description={items.length ? "Pick a credential from the left list." : "Add your first credential to begin tracking."} />
              </Surface>
            ) : (
              <>
                <Surface>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Credential detail</p>
                      <h2 className="mt-2 truncate text-2xl font-semibold text-[var(--text-main)]">{selected.name}</h2>
                      <p className="mt-2 text-sm text-[var(--text-soft)]">
                        {statusLabel(selected.status, selected.daysLeft)}
                        {selected.derivedExpiresAt ? ` • Expires ${new Date(selected.derivedExpiresAt).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void rotateCredential()}
                        className="h-11 rounded-2xl border px-4 text-sm font-semibold disabled:opacity-70"
                        style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}
                      >
                        Mark rotated now
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void deleteCredential(selected.id)}
                        className="h-11 rounded-2xl px-4 text-sm font-semibold text-white disabled:opacity-70"
                        style={{ background: "var(--danger)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium text-[var(--text-main)]">
                      Name
                      <input className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm outline-none" style={FIELD_STYLE} value={editForm.name} onChange={(e) => setEditForm((c) => ({ ...c, name: e.target.value }))} />
                    </label>
                    <label className="text-sm font-medium text-[var(--text-main)]">
                      Provider
                      <input className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm outline-none" style={FIELD_STYLE} value={editForm.provider} onChange={(e) => setEditForm((c) => ({ ...c, provider: e.target.value }))} />
                    </label>
                    <label className="text-sm font-medium text-[var(--text-main)]">
                      Default env key
                      <input className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm outline-none" style={FIELD_STYLE} value={editForm.envKey} onChange={(e) => setEditForm((c) => ({ ...c, envKey: e.target.value }))} />
                    </label>
                    <label className="text-sm font-medium text-[var(--text-main)]">
                      Validity days
                      <input className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm outline-none" style={FIELD_STYLE} value={editForm.validityDays} onChange={(e) => setEditForm((c) => ({ ...c, validityDays: e.target.value }))} />
                    </label>
                    <label className="text-sm font-medium text-[var(--text-main)]">
                      Expires on
                      <input type="date" className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm outline-none" style={FIELD_STYLE} value={editForm.expiresAt} onChange={(e) => setEditForm((c) => ({ ...c, expiresAt: e.target.value }))} />
                    </label>
                  </div>

                  <label className="mt-4 block text-sm font-medium text-[var(--text-main)]">
                    Notes
                    <textarea className="mt-2 min-h-24 w-full rounded-2xl border px-4 py-3 text-sm outline-none" style={FIELD_STYLE} value={editForm.notes} onChange={(e) => setEditForm((c) => ({ ...c, notes: e.target.value }))} />
                  </label>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveCredentialEdits()}
                    className="mt-4 h-11 rounded-2xl px-5 text-sm font-semibold text-white disabled:opacity-70"
                    style={{ background: "var(--accent-strong)" }}
                  >
                    {saving ? "Saving..." : "Save credential changes"}
                  </button>
                </Surface>

                <Surface>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Used in projects</p>
                  <h3 className="mt-2 text-xl font-semibold text-[var(--text-main)]">Where this API key is used</h3>
                  <p className="mt-2 text-sm text-[var(--text-soft)]">
                    Developers see this list on each linked project board. Link multiple CRM projects and add custom repo names for anything outside the CRM.
                  </p>

                  {(selected.usages ?? []).length > 0 ? (
                    <div className="mt-4 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--border)" }}>
                      <table className="min-w-full text-left text-sm">
                        <thead style={{ background: "var(--surface-soft)" }}>
                          <tr className="text-xs uppercase tracking-[0.16em] text-[var(--text-faint)]">
                            <th className="px-4 py-3">Project name</th>
                            <th className="px-4 py-3">Environment</th>
                            <th className="px-4 py-3">Env key</th>
                            <th className="px-4 py-3">Notes</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {selected.usages.map((usage) => (
                            <tr key={usage.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                              <td className="px-4 py-3 font-semibold text-[var(--text-main)]">{usageDisplayName(usage)}</td>
                              <td className="px-4 py-3 text-[var(--text-soft)]">{usage.environment ?? "ALL"}</td>
                              <td className="px-4 py-3 text-[var(--text-soft)]">{usage.envKey ?? selected.envKey ?? "—"}</td>
                              <td className="px-4 py-3 text-[var(--text-soft)]">{usage.notes ?? "—"}</td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void removeUsage(selected.id, usage.id)}
                                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-70"
                                  style={{ background: "var(--danger)" }}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-2xl border px-4 py-6 text-sm text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>
                      No projects linked yet. Add CRM projects or custom project names below.
                    </p>
                  )}

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium text-[var(--text-main)]">
                      Default environment for new links
                      <div className="mt-2">
                        <ResponsiveSelect
                          value={linkDraft.environment}
                          onChange={(value) => setLinkDraft((c) => ({ ...c, environment: value }))}
                          options={envOptions}
                          ariaLabel="Select environment"
                          buttonClassName="h-11 px-4"
                        />
                      </div>
                    </label>
                    <label className="text-sm font-medium text-[var(--text-main)]">
                      Env key override (optional)
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm outline-none"
                        style={FIELD_STYLE}
                        placeholder={selected.envKey ?? "GROK_API_KEY"}
                        value={linkDraft.envKey}
                        onChange={(e) => setLinkDraft((c) => ({ ...c, envKey: e.target.value }))}
                      />
                    </label>
                  </div>

                  <div className="mt-5">
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
                    className="mt-3 min-h-20 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={FIELD_STYLE}
                    placeholder="Shared notes for these new links (optional)"
                    value={linkDraft.notes}
                    onChange={(e) => setLinkDraft((c) => ({ ...c, notes: e.target.value }))}
                  />

                  <button
                    type="button"
                    disabled={saving || linkPendingLinks.length === 0}
                    onClick={() => void linkProjects(selected.id)}
                    className="mt-3 h-11 rounded-2xl px-5 text-sm font-semibold text-white disabled:opacity-70"
                    style={{ background: "var(--accent-strong)" }}
                  >
                    {saving ? "Saving..." : "Link added projects"}
                  </button>
                </Surface>

                {error ? (
                  <Surface>
                    <StatePanel title="Something went wrong" description={error} />
                  </Surface>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </CRMShell>
  );
}
