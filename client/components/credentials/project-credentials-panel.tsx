"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { statusLabel, usageDisplayName } from "@/lib/credential-usage";
import type { Credential } from "@/types/crm";

type ProjectCredentialsResponse = {
  project: { id: string; name: string };
  credentials: Credential[];
};

function statusColor(status: Credential["status"]) {
  if (status === "EXPIRED") return "var(--danger)";
  if (status === "EXPIRING_SOON") return "#b45309";
  if (status === "VALID") return "var(--success)";
  return "var(--text-soft)";
}

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
        Developers can see which API keys power this project and whether any are expiring or already expired.
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
            const projectUsages = (credential.usages ?? []).filter(
              (usage) => usage.projectId === projectId || usage.projectName === projectName
            );
            return (
              <div
                key={credential.id}
                className="rounded-2xl border px-4 py-4"
                style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text-main)]">{credential.name}</p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                      {credential.provider ?? "Provider not set"}
                      {credential.envKey ? ` • ${credential.envKey}` : ""}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white"
                    style={{ background: statusColor(credential.status) }}
                  >
                    {statusLabel(credential.status, credential.daysLeft)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {projectUsages.map((usage) => (
                    <span
                      key={usage.id}
                      className="rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{ borderColor: "var(--border)", color: "var(--text-main)", background: "var(--surface)" }}
                    >
                      {usage.environment ?? "ALL"} • {usage.envKey ?? credential.envKey ?? "env key not set"}
                    </span>
                  ))}
                </div>
                {credential.derivedExpiresAt ? (
                  <p className="mt-3 text-xs text-[var(--text-faint)]">
                    Expires {new Date(credential.derivedExpiresAt).toLocaleDateString()}
                    {credential.daysLeft !== null ? ` (${credential.daysLeft} days left)` : ""}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
