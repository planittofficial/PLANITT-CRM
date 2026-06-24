"use client";

import { useMemo } from "react";
import { ResponsiveSelect } from "@/components/shared/responsive-select";

const FIELD_STYLE = { borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" } as const;

export type PendingProjectLink =
  | { key: string; kind: "listed"; projectId: string; label: string }
  | { key: string; kind: "custom"; projectName: string };

type ProjectLinkPickerProps = {
  projects: Array<{ id: string; name: string; department?: { name: string } | null }>;
  mode: "listed" | "custom";
  onModeChange: (mode: "listed" | "custom") => void;
  selectedProjectId: string;
  onSelectedProjectIdChange: (value: string) => void;
  customProjectName: string;
  onCustomProjectNameChange: (value: string) => void;
  pendingLinks: PendingProjectLink[];
  onAdd: () => void;
  onRemove: (key: string) => void;
  excludedProjectIds?: Set<string>;
  excludedCustomNames?: Set<string>;
};

export function ProjectLinkPicker({
  projects,
  mode,
  onModeChange,
  selectedProjectId,
  onSelectedProjectIdChange,
  customProjectName,
  onCustomProjectNameChange,
  pendingLinks,
  onAdd,
  onRemove,
  excludedProjectIds,
  excludedCustomNames,
}: ProjectLinkPickerProps) {
  const projectOptions = useMemo(() => {
    const pendingIds = new Set(
      pendingLinks.filter((link): link is Extract<PendingProjectLink, { kind: "listed" }> => link.kind === "listed").map((link) => link.projectId)
    );
    return [
      { value: "", label: "Select a project from the list" },
      ...projects.map((project) => {
        const disabled = excludedProjectIds?.has(project.id) || pendingIds.has(project.id);
        const dept = project.department?.name ? ` — ${project.department.name}` : "";
        return {
          value: project.id,
          label: disabled ? `${project.name}${dept} (already added)` : `${project.name}${dept}`,
          disabled,
        };
      }),
    ];
  }, [projects, pendingLinks, excludedProjectIds]);

  const canAddListed = mode === "listed" && Boolean(selectedProjectId);
  const canAddCustom = mode === "custom" && customProjectName.trim().length > 0;

  return (
    <div className="min-w-0 space-y-3">
      <div
        className="inline-flex rounded-xl border p-1"
        style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
        role="tablist"
        aria-label="Project link type"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "listed"}
          onClick={() => onModeChange("listed")}
          className="rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm"
          style={
            mode === "listed"
              ? { background: "var(--surface-strong)", color: "var(--text-main)", boxShadow: "var(--shadow-card)" }
              : { color: "var(--text-soft)" }
          }
        >
          Listed project
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "custom"}
          onClick={() => onModeChange("custom")}
          className="rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm"
          style={
            mode === "custom"
              ? { background: "var(--surface-strong)", color: "var(--text-main)", boxShadow: "var(--shadow-card)" }
              : { color: "var(--text-soft)" }
          }
        >
          New / unlisted project
        </button>
      </div>

      {mode === "listed" ? (
        <div>
          <p className="text-sm font-medium text-(--text-main)">Choose from CRM projects</p>
          <p className="mt-1 text-xs text-(--text-soft)">
            Pick a project board that already exists in the CRM.
            {projects.length > 0 ? ` ${projects.length} project${projects.length === 1 ? "" : "s"} available.` : " No projects found in CRM yet."}
          </p>
          <div className="relative z-10 mt-2">
            <ResponsiveSelect
              value={selectedProjectId}
              onChange={onSelectedProjectIdChange}
              options={projectOptions}
              ariaLabel="Select project"
              buttonClassName="h-11 px-4"
            />
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-(--text-main)">Project not in the list?</p>
          <p className="mt-1 text-xs text-(--text-soft)">Type the project or repo name manually if it is not created in CRM yet.</p>
          <input
            className="mt-2 h-11 w-full rounded-2xl border px-4 text-sm outline-none"
            style={FIELD_STYLE}
            placeholder="e.g. Mobile App Repo, Client WordPress Site"
            value={customProjectName}
            onChange={(e) => onCustomProjectNameChange(e.target.value)}
          />
          {customProjectName.trim() && excludedCustomNames?.has(customProjectName.trim().toLowerCase()) ? (
            <p className="mt-2 text-xs text-rose-600">This project name is already linked.</p>
          ) : null}
        </div>
      )}

      <button
        type="button"
        disabled={!(canAddListed || canAddCustom)}
        onClick={onAdd}
        className="h-10 rounded-xl border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
      >
        + Add project to list
      </button>

      {pendingLinks.length > 0 ? (
        <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--text-faint)">
            Projects to link ({pendingLinks.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pendingLinks.map((link) => (
              <span
                key={link.key}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-main)" }}
              >
                <span>{link.kind === "listed" ? link.label : link.projectName}</span>
                <span className="rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-(--text-faint)">
                  {link.kind === "listed" ? "CRM" : "Custom"}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(link.key)}
                  className="text-(--text-soft) hover:text-(--danger)"
                  aria-label={`Remove ${link.kind === "listed" ? link.label : link.projectName}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-(--text-faint)">Add one or more projects using the dropdown or custom name field.</p>
      )}
    </div>
  );
}

export function pendingLinksToPayload(links: PendingProjectLink[]) {
  return {
    projectIds: links.filter((link): link is Extract<PendingProjectLink, { kind: "listed" }> => link.kind === "listed").map((link) => link.projectId),
    customProjectNames: links
      .filter((link): link is Extract<PendingProjectLink, { kind: "custom" }> => link.kind === "custom")
      .map((link) => link.projectName),
  };
}
