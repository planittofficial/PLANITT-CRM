"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { statusLabel, statusTone } from "@/lib/credential-usage";
import { EnvVariableChip } from "@/components/credentials/credential-summary-header";
import type { Credential } from "@/types/crm";

type ProjectCredentialsResponse = {
  project: { id: string; name: string };
  credentials: Credential[];
};

export function ProjectCredentialsPanel({ projectId }: { projectId: string }) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await apiGet<ProjectCredentialsResponse>(`/credentials/project/${projectId}`);
        if (!cancelled) {
          setCredentials(data.credentials ?? []);
          setProjectName(data.project?.name ?? "");
        }
      } catch (err) {
        if (!cancelled) {
          setCredentials([]);
          setError(err instanceof Error ? err.message : "Failed to load API credentials");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong,#ffffff)] p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-[var(--border)] pb-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-soft)]">
            API Credentials
          </span>
          <h3 className="text-base font-bold text-[var(--text-main)]">Keys & Environment Variables</h3>
        </div>
        <span className="text-xs text-[var(--text-faint)]">
          Secret values are encrypted & never exposed client-side.
        </span>
      </div>

      {loading ? (
        <p className="mt-4 text-xs text-[var(--text-soft)]">Loading credentials…</p>
      ) : error ? (
        <p className="mt-4 text-xs text-rose-600">{error}</p>
      ) : credentials.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--text-soft)]">
          No API credentials are linked to this project yet.
        </p>
      ) : (
        <div className="mt-3.5 space-y-2.5">
          {credentials.map((credential) => {
            const tone = statusTone(credential.status);
            const projectUsages = (credential.usages ?? []).filter(
              (usage) => usage.projectId === projectId || usage.projectName === projectName
            );
            return (
              <div
                key={credential.id}
                className="min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] transition-colors hover:border-[var(--accent)]/40"
              >
                <div className="flex min-w-0">
                  <div className="w-1 shrink-0" style={{ background: tone.stroke }} aria-hidden />
                  <div className="min-w-0 flex-1 p-3 sm:p-3.5">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--text-main)]">{credential.name}</p>
                        <p className="mt-0.5 text-xs text-[var(--text-soft)]">{credential.provider ?? "Provider not set"}</p>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                        style={{ background: tone.fill, color: tone.text }}
                      >
                        {statusLabel(credential.status, credential.daysLeft)}
                      </span>
                    </div>

                    <div className="mt-2.5">
                      <EnvVariableChip value={credential.envKey} credentialName={credential.name} />
                    </div>

                    {projectUsages.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {projectUsages.map((usage) => (
                          <span
                            key={usage.id}
                            className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs font-medium text-[var(--text-main)]"
                          >
                            <span className="shrink-0 text-[10px] font-semibold uppercase text-[var(--text-faint)]">
                              {usage.environment ?? "ALL"}
                            </span>
                            <EnvVariableChip value={usage.envKey ?? credential.envKey} credentialName={credential.name} />
                          </span>
                        ))}
                      </div>
                    )}

                    {credential.derivedExpiresAt ? (
                      <p className="mt-2 text-[11px] text-[var(--text-faint)]">
                        Expires {new Date(credential.derivedExpiresAt).toLocaleDateString()}
                        {credential.daysLeft !== null ? ` · ${credential.daysLeft} days left` : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
