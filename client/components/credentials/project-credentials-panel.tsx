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
    <section
      className="rounded-[20px] border p-5"
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-soft)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">API credentials</p>
      <h3 className="mt-2 text-xl font-semibold text-[var(--text-main)]">Keys used in this project</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-soft)]">
        Credential metadata for this project. Secret values are never displayed here.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--text-soft)]">Loading credentials…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-rose-600">{error}</p>
      ) : credentials.length === 0 ? (
        <p className="mt-4 rounded-2xl border px-4 py-6 text-sm text-[var(--text-soft)]" style={{ borderColor: "var(--border)" }}>
          No API credentials are linked to this project yet. Admins can link them from the Credentials tab.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {credentials.map((credential) => {
            const tone = statusTone(credential.status);
            const projectUsages = (credential.usages ?? []).filter(
              (usage) => usage.projectId === projectId || usage.projectName === projectName
            );
            return (
              <div
                key={credential.id}
                className="min-w-0 overflow-hidden rounded-2xl border"
                style={{ borderColor: tone.stroke, background: "var(--surface-soft)" }}
              >
                <div className="flex min-w-0">
                  <div className="w-1 shrink-0" style={{ background: tone.stroke }} aria-hidden />
                  <div className="min-w-0 flex-1 px-4 py-4">
                    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--text-main)]">{credential.name}</p>
                        <p className="mt-1 text-xs text-[var(--text-soft)]">{credential.provider ?? "Provider not set"}</p>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                        style={{ background: tone.fill, color: tone.text }}
                      >
                        {statusLabel(credential.status, credential.daysLeft)}
                      </span>
                    </div>
                    <div className="mt-3">
                      <EnvVariableChip value={credential.envKey} credentialName={credential.name} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {projectUsages.map((usage) => (
                        <span
                          key={usage.id}
                          className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                          style={{ borderColor: "var(--border)", color: "var(--text-main)", background: "var(--surface)" }}
                        >
                          <span className="shrink-0 uppercase text-[10px] text-[var(--text-faint)]">
                            {usage.environment ?? "ALL"}
                          </span>
                          <EnvVariableChip value={usage.envKey ?? credential.envKey} credentialName={credential.name} />
                        </span>
                      ))}
                    </div>
                    {credential.derivedExpiresAt ? (
                      <p className="mt-3 text-xs text-[var(--text-faint)]">
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
