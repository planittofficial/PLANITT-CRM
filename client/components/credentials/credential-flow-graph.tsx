"use client";

import { statusTone, usageDisplayName } from "@/lib/credential-usage";
import { EnvVariableChip } from "@/components/credentials/credential-summary-header";
import type { Credential, CredentialUsage } from "@/types/crm";

type CredentialFlowGraphProps = {
  credential: Credential;
  selectedUsageId?: string;
  onUsageClick?: (usage: CredentialUsage) => void;
};

function TargetNode({
  usage,
  credential,
  index,
  selected,
  isLast,
  onClick,
}: {
  usage: CredentialUsage;
  credential: Credential;
  index: number;
  selected: boolean;
  isLast: boolean;
  onClick?: () => void;
}) {
  const tone = statusTone(credential.status);
  const needsUpdate = credential.status === "EXPIRED" || credential.status === "EXPIRING_SOON";

  return (
    <div className="relative flex min-w-0 gap-3">
      <div className="flex w-8 shrink-0 flex-col items-center">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-bold ${needsUpdate && tone.pulse ? "credential-flow-pulse" : ""}`}
          style={{
            borderColor: tone.stroke,
            background: tone.fill,
            color: tone.text,
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>
        {!isLast ? (
          <div
            className="mt-1 w-px flex-1 min-h-[20px]"
            style={{ background: `linear-gradient(to bottom, ${tone.stroke}, color-mix(in srgb, ${tone.stroke} 25%, transparent))` }}
            aria-hidden
          />
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClick}
        className={`mb-3 min-w-0 flex-1 rounded-2xl border px-3 py-3 text-left transition sm:px-4 ${needsUpdate && tone.pulse ? "credential-flow-pulse" : ""}`}
        style={{
          borderColor: selected ? "var(--accent-strong)" : tone.stroke,
          background: selected ? "color-mix(in srgb, var(--accent) 6%, var(--surface))" : "var(--surface)",
          boxShadow: selected ? "0 0 0 2px color-mix(in srgb, var(--accent-strong) 20%, transparent)" : undefined,
        }}
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-semibold text-(--text-main)">{usageDisplayName(usage)}</p>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{ background: tone.fill, color: tone.text }}
          >
            {usage.environment ?? "ALL"}
          </span>
        </div>
        <div className="mt-2">
          <EnvVariableChip value={usage.envKey ?? credential.envKey} credentialName={credential.name} />
        </div>
        {usage.notes ? <p className="mt-2 line-clamp-2 text-xs text-(--text-faint)">{usage.notes}</p> : null}
        {credential.status === "EXPIRED" ? (
          <p className="mt-2 text-xs font-semibold text-(--danger)">Rotate key here</p>
        ) : credential.status === "EXPIRING_SOON" ? (
          <p className="mt-2 text-xs font-semibold" style={{ color: tone.text }}>
            Update before expiry
          </p>
        ) : null}
      </button>
    </div>
  );
}

export function CredentialFlowGraph({ credential, selectedUsageId, onUsageClick }: CredentialFlowGraphProps) {
  const tone = statusTone(credential.status);
  const usages = credential.usages ?? [];

  return (
    <div className="min-w-0 overflow-hidden">
      <style>{`
        @keyframes credential-flow-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${tone.glow}; }
          50% { box-shadow: 0 0 0 2px ${tone.glow}; }
        }
        .credential-flow-pulse { animation: credential-flow-pulse 1.8s ease-in-out infinite; }
      `}</style>

      <div
        className="relative min-w-0 overflow-hidden rounded-2xl border"
        style={{
          borderColor: tone.stroke,
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--surface-soft) 70%, var(--surface)) 0%, var(--surface) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--border) 80%, transparent) 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
          aria-hidden
        />

        <div className="relative min-w-0 p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b pb-4" style={{ borderColor: "var(--border)" }}>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-faint)">Deployment pipeline</p>
              <p className="mt-1 text-sm text-(--text-soft)">Environments that consume this key — update each when rotating.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {[
                { label: "Valid", color: "#10b981" },
                { label: "Expiring", color: "#f59e0b" },
                { label: "Expired", color: "#ef4444" },
              ].map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold text-(--text-soft)"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          {usages.length === 0 ? (
            <div
              className="mt-4 rounded-xl border border-dashed px-4 py-10 text-center text-sm text-(--text-soft)"
              style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
            >
              No deployment targets linked. Open <strong>Manage</strong> to add projects.
            </div>
          ) : (
            <div className="mt-4 max-h-[min(52vh,480px)] min-w-0 overflow-y-auto overscroll-contain pr-1">
              {usages.map((usage, index) => (
                <TargetNode
                  key={usage.id}
                  usage={usage}
                  credential={credential}
                  index={index}
                  isLast={index === usages.length - 1}
                  selected={selectedUsageId === usage.id}
                  onClick={() => onUsageClick?.(usage)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
