"use client";

import { useMemo } from "react";
import { CRMShell } from "@/components/layout/crm-shell";
import { StatePanel } from "@/components/shared/state-panel";
import { ResponsiveSelect } from "@/components/shared/responsive-select";
import { useCredentialsData } from "@/hooks/use-credentials-data";

const FIELD_STYLE = { borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" } as const;

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
    loading,
    saving,
    error,
    sessionGate,
    items,
    projects,
    selectedId,
    setSelectedId,
    selected,
    counts,
    createForm,
    setCreateForm,
    usageDraft,
    setUsageDraft,
    createCredential,
    updateCredential,
    deleteCredential,
    addUsage,
    removeUsage,
  } = useCredentialsData();

  const projectOptions = useMemo(
    () => [{ value: "", label: "Select project" }, ...projects.map((p) => ({ value: p.id, label: p.name }))],
    [projects]
  );
  const envOptions = useMemo(
    () => ["PROD", "STAGING", "DEV", "LOCAL"].map((x) => ({ value: x, label: x })),
    []
  );

  if (sessionGate) return sessionGate;
  if (!user) return null;

  return (
    <CRMShell user={user}>
      <div className="min-w-0 space-y-4 overflow-x-hidden pb-4">
        <Surface>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Credentials registry</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text-main)]">API keys & expiry tracking</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
            Track which credentials are expiring (e.g. Grok keys valid for 90 days) and see exactly which projects must be updated.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total", value: counts.total },
              { label: "Expired", value: counts.expired },
              { label: "Expiring soon (≤14d)", value: counts.expiringSoon },
              { label: "Unknown expiry", value: counts.unknown },
            ].map((stat) => (
              <div key={stat.label} className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">{stat.label}</p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-main)]">{stat.value}</p>
              </div>
            ))}
          </div>
        </Surface>

        <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
          <aside className="space-y-4">
            <Surface>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">All credentials</p>
              <div className="mt-4 space-y-3">
                {items.length === 0 ? (
                  <p className="rounded-2xl border px-4 py-6 text-sm text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>
                    No credentials added yet.
                  </p>
                ) : (
                  items.map((c) => {
                    const sel = c.id === selectedId;
                    const badge = statusStyle(c.status);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className="w-full rounded-2xl border px-4 py-4 text-left transition"
                        style={
                          sel
                            ? { borderColor: "#0f172a", background: "#0f172a", color: "#ffffff" }
                            : { borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{c.name}</p>
                            <p className={`mt-1 text-xs ${sel ? "text-slate-300" : "text-[var(--text-soft)]"}`}>
                              {c.provider ? c.provider : "Provider not set"}
                              {c.envKey ? ` • ${c.envKey}` : ""}
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                            style={{ background: sel ? "rgba(255,255,255,0.14)" : badge.bg, color: sel ? "white" : badge.fg }}
                          >
                            {c.status === "EXPIRING_SOON" ? `Expiring (${c.daysLeft}d)` : c.status}
                          </span>
                        </div>
                        <p className={`mt-3 text-xs ${sel ? "text-slate-300" : "text-[var(--text-faint)]"}`}>
                          Used in {c.usages?.length ?? 0} project{(c.usages?.length ?? 0) === 1 ? "" : "s"}
                        </p>
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
                <textarea
                  className="min-h-24 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
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
                  {saving ? "Saving..." : "Add credential"}
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
                        Status: <span className="font-semibold">{selected.status}</span>
                        {selected.daysLeft !== null ? ` • ${selected.daysLeft} days left` : ""}
                        {selected.derivedExpiresAt ? ` • Expires ${new Date(selected.derivedExpiresAt).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void updateCredential(selected.id, { rotatedAt: new Date().toISOString() })}
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
                      Provider
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm outline-none"
                        style={FIELD_STYLE}
                        value={selected.provider ?? ""}
                        onChange={(e) => void updateCredential(selected.id, { provider: e.target.value })}
                      />
                    </label>
                    <label className="text-sm font-medium text-[var(--text-main)]">
                      Env key (default)
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm outline-none"
                        style={FIELD_STYLE}
                        value={selected.envKey ?? ""}
                        onChange={(e) => void updateCredential(selected.id, { envKey: e.target.value })}
                      />
                    </label>
                    <label className="text-sm font-medium text-[var(--text-main)]">
                      Validity days
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm outline-none"
                        style={FIELD_STYLE}
                        value={selected.validityDays ?? ""}
                        onChange={(e) => void updateCredential(selected.id, { validityDays: e.target.value ? Number(e.target.value) : null } as any)}
                      />
                    </label>
                    <label className="text-sm font-medium text-[var(--text-main)]">
                      Expires on
                      <input
                        type="date"
                        className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm outline-none"
                        style={FIELD_STYLE}
                        value={selected.expiresAt ? new Date(selected.expiresAt).toISOString().slice(0, 10) : ""}
                        onChange={(e) => void updateCredential(selected.id, { expiresAt: e.target.value || null } as any)}
                      />
                    </label>
                  </div>

                  <label className="mt-4 block text-sm font-medium text-[var(--text-main)]">
                    Notes
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={FIELD_STYLE}
                      value={selected.notes ?? ""}
                      onChange={(e) => void updateCredential(selected.id, { notes: e.target.value })}
                    />
                  </label>
                </Surface>

                <Surface>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">Where it is used</p>
                      <h3 className="mt-2 text-xl font-semibold text-[var(--text-main)]">Project usage tracking</h3>
                      <p className="mt-2 text-sm text-[var(--text-soft)]">
                        Link this credential to projects so developers know exactly what must be updated when it expires.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_1fr]">
                    <ResponsiveSelect
                      value={usageDraft.projectId}
                      onChange={(value) => setUsageDraft((c) => ({ ...c, projectId: value }))}
                      options={projectOptions}
                      ariaLabel="Select project"
                      buttonClassName="h-11 px-4"
                    />
                    <ResponsiveSelect
                      value={usageDraft.environment}
                      onChange={(value) => setUsageDraft((c) => ({ ...c, environment: value }))}
                      options={envOptions}
                      ariaLabel="Select environment"
                      buttonClassName="h-11 px-4"
                    />
                    <input
                      className="h-11 w-full rounded-2xl border px-4 text-sm outline-none"
                      style={FIELD_STYLE}
                      placeholder="Env key in project (optional override)"
                      value={usageDraft.envKey}
                      onChange={(e) => setUsageDraft((c) => ({ ...c, envKey: e.target.value }))}
                    />
                  </div>
                  <textarea
                    className="mt-3 min-h-20 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={FIELD_STYLE}
                    placeholder="Notes (optional) — e.g. Vercel PROD env, server/.env, used by chat module"
                    value={usageDraft.notes}
                    onChange={(e) => setUsageDraft((c) => ({ ...c, notes: e.target.value }))}
                  />
                  <button
                    type="button"
                    disabled={saving || !usageDraft.projectId}
                    onClick={() => void addUsage(selected.id)}
                    className="mt-3 h-11 rounded-2xl px-5 text-sm font-semibold text-white disabled:opacity-70"
                    style={{ background: "var(--accent-strong)" }}
                  >
                    {saving ? "Saving..." : "Link to project"}
                  </button>

                  <div className="mt-5 space-y-2">
                    {(selected.usages ?? []).length === 0 ? (
                      <p className="rounded-2xl border px-4 py-6 text-sm text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>
                        No usage links yet. Add at least one project so expiry alerts are actionable.
                      </p>
                    ) : (
                      selected.usages.map((u) => (
                        <div
                          key={u.id}
                          className="flex flex-col gap-2 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                          style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--text-main)]">
                              {u.project.name} {u.environment ? `• ${u.environment}` : ""}
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-soft)]">
                              {u.envKey ? `Env key: ${u.envKey}` : selected.envKey ? `Env key: ${selected.envKey}` : "Env key not set"}
                              {u.notes ? ` • ${u.notes}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void removeUsage(selected.id, u.id)}
                            className="h-10 shrink-0 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-70"
                            style={{ background: "var(--danger)" }}
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
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

