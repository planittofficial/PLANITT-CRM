"use client";

import { resolveEnvKeyDisplay, statusLabel, statusTone } from "@/lib/credential-usage";
import type { Credential } from "@/types/crm";

type CredentialSummaryHeaderProps = {
  credential: Credential;
  children?: React.ReactNode;
};

function MetaItem({
  label,
  value,
  hint,
  mono = false,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{label}</dt>
      <dd className={`mt-1 truncate text-sm font-medium text-[var(--text-main)] ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
      {hint ? <p className="mt-1 text-[11px] text-[var(--text-soft)]">{hint}</p> : null}
    </div>
  );
}

export function CredentialSummaryHeader({ credential, children }: CredentialSummaryHeaderProps) {
  const tone = statusTone(credential.status);
  const envDisplay = resolveEnvKeyDisplay(credential.envKey, credential.name);
  const targetCount = (credential.usages ?? []).length;
  const expiryText = credential.derivedExpiresAt
    ? new Date(credential.derivedExpiresAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Not set";

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border" style={{ borderColor: tone.stroke, background: "var(--surface)" }}>
      <div className="flex min-w-0">
        <div className="w-1 shrink-0" style={{ background: tone.stroke }} aria-hidden />
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-faint)]">Selected credential</p>
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="min-w-0 truncate text-xl font-semibold tracking-tight text-[var(--text-main)]">{credential.name}</h2>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{ background: tone.fill, color: tone.text }}
                >
                  {statusLabel(credential.status, credential.daysLeft)}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Registry metadata only — secret values are never shown in this workspace.
              </p>
            </div>
            {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
          </div>

          <dl className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetaItem label="Provider" value={credential.provider?.trim() || "Not specified"} />
            <MetaItem
              label="Env variable"
              value={envDisplay.label}
              hint={envDisplay.isSecret ? "Secret value hidden" : envDisplay.hint}
              mono
            />
            <MetaItem
              label="Expiry"
              value={expiryText}
              hint={
                credential.daysLeft !== null && credential.status !== "UNKNOWN"
                  ? `${credential.daysLeft} day${credential.daysLeft === 1 ? "" : "s"} remaining`
                  : undefined
              }
            />
            <MetaItem
              label="Deployments"
              value={`${targetCount} linked`}
              hint={targetCount === 0 ? "No project targets yet" : "Project environments using this credential"}
            />
          </dl>
        </div>
      </div>
    </div>
  );
}

export function EnvVariableChip({
  value,
  credentialName,
}: {
  value: string | null | undefined;
  credentialName?: string | null;
}) {
  const envDisplay = resolveEnvKeyDisplay(value, credentialName);

  return (
    <span
      className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px]"
      style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}
      title={envDisplay.isSecret ? "Secret value is hidden in the UI" : envDisplay.label}
    >
      {envDisplay.isSecret ? (
        <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0 text-[var(--text-faint)]" aria-hidden>
          <path
            fill="currentColor"
            d="M8 1a4 4 0 0 0-4 4v2H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4Zm-2 6V5a2 2 0 1 1 4 0v2H6Z"
          />
        </svg>
      ) : null}
      <span className="truncate">{envDisplay.label}</span>
    </span>
  );
}
