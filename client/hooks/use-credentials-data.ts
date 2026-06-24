"use client";

import { useEffect, useMemo, useState } from "react";
import {
  pendingLinksToPayload,
  type PendingProjectLink,
} from "@/components/credentials/project-link-picker";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { credentialProjectNames } from "@/lib/credential-usage";
import { useSession } from "@/hooks/use-session";
import { renderSessionGate } from "@/components/shared/session-gate";
import type { Credential, Project } from "@/types/crm";
import { showToast } from "./use-toast";

const EMPTY_EDIT = {
  name: "",
  provider: "",
  envKey: "",
  validityDays: "",
  expiresAt: "",
  notes: "",
};

type ProjectPickerState = {
  mode: "listed" | "custom";
  projectId: string;
  customName: string;
};

const EMPTY_PICKER: ProjectPickerState = { mode: "listed", projectId: "", customName: "" };

function makeLinkKey(kind: PendingProjectLink["kind"], value: string) {
  return `${kind}:${value}`;
}

export function useCredentialsData() {
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession({
    allowedRoles: ["SUPERADMIN", "ADMIN"],
  });

  const [items, setItems] = useState<Credential[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<string>("");
  const selected = useMemo(() => items.find((c) => c.id === selectedId) ?? null, [items, selectedId]);

  const [createForm, setCreateForm] = useState({
    name: "",
    provider: "",
    envKey: "",
    validityDays: "90",
    expiresAt: "",
    notes: "",
  });
  const [createPicker, setCreatePicker] = useState<ProjectPickerState>(EMPTY_PICKER);
  const [createPendingLinks, setCreatePendingLinks] = useState<PendingProjectLink[]>([]);

  const [linkDraft, setLinkDraft] = useState({
    environment: "PROD",
    envKey: "",
    notes: "",
  });
  const [linkPicker, setLinkPicker] = useState<ProjectPickerState>(EMPTY_PICKER);
  const [linkPendingLinks, setLinkPendingLinks] = useState<PendingProjectLink[]>([]);

  const [editForm, setEditForm] = useState(EMPTY_EDIT);

  useEffect(() => {
    if (!selected) {
      setEditForm(EMPTY_EDIT);
      return;
    }
    setEditForm({
      name: selected.name,
      provider: selected.provider ?? "",
      envKey: selected.envKey ?? "",
      validityDays: selected.validityDays != null ? String(selected.validityDays) : "",
      expiresAt: selected.expiresAt ? new Date(selected.expiresAt).toISOString().slice(0, 10) : "",
      notes: selected.notes ?? "",
    });
  }, [selected?.id, selected?.updatedAt]);

  const load = async () => {
    const [creds, projs] = await Promise.all([apiGet<Credential[]>("/credentials"), apiGet<Project[]>("/projects")]);
    setItems(creds);
    setProjects(projs);
    if (!selectedId && creds[0]) setSelectedId(creds[0].id);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function boot() {
      try {
        setError("");
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load credentials");
          showToast(err instanceof Error ? err.message : "Failed to load credentials", "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const linkedProjectIdsForSelected = useMemo(() => {
    return new Set((selected?.usages ?? []).map((usage) => usage.projectId).filter(Boolean) as string[]);
  }, [selected]);

  const linkedCustomNamesForSelected = useMemo(() => {
    return new Set(
      (selected?.usages ?? [])
        .map((usage) => (usage.projectName ?? "").trim().toLowerCase())
        .filter(Boolean)
    );
  }, [selected]);

  const addCreatePendingLink = () => {
    if (createPicker.mode === "listed") {
      if (!createPicker.projectId) {
        showToast("Select a project from the dropdown.", "error");
        return;
      }
      const project = projects.find((item) => item.id === createPicker.projectId);
      if (!project) return;
      const key = makeLinkKey("listed", createPicker.projectId);
      if (createPendingLinks.some((link) => link.key === key)) return;
      setCreatePendingLinks((current) => [
        ...current,
        { key, kind: "listed", projectId: project.id, label: project.name },
      ]);
      setCreatePicker((current) => ({ ...current, projectId: "" }));
      return;
    }

    const projectName = createPicker.customName.trim();
    if (!projectName) {
      showToast("Enter a project name for the unlisted project.", "error");
      return;
    }
    const key = makeLinkKey("custom", projectName.toLowerCase());
    if (createPendingLinks.some((link) => link.key === key)) {
      showToast("This project name is already in the list.", "error");
      return;
    }
    setCreatePendingLinks((current) => [...current, { key, kind: "custom", projectName }]);
    setCreatePicker((current) => ({ ...current, customName: "" }));
  };

  const addLinkPendingLink = () => {
    if (linkPicker.mode === "listed") {
      if (!linkPicker.projectId) {
        showToast("Select a project from the dropdown.", "error");
        return;
      }
      if (linkedProjectIdsForSelected.has(linkPicker.projectId)) {
        showToast("This project is already linked to the credential.", "error");
        return;
      }
      const project = projects.find((item) => item.id === linkPicker.projectId);
      if (!project) return;
      const key = makeLinkKey("listed", linkPicker.projectId);
      if (linkPendingLinks.some((link) => link.key === key)) return;
      setLinkPendingLinks((current) => [
        ...current,
        { key, kind: "listed", projectId: project.id, label: project.name },
      ]);
      setLinkPicker((current) => ({ ...current, projectId: "" }));
      return;
    }

    const projectName = linkPicker.customName.trim();
    if (!projectName) {
      showToast("Enter a project name for the unlisted project.", "error");
      return;
    }
    if (linkedCustomNamesForSelected.has(projectName.toLowerCase())) {
      showToast("This project name is already linked to the credential.", "error");
      return;
    }
    const key = makeLinkKey("custom", projectName.toLowerCase());
    if (linkPendingLinks.some((link) => link.key === key)) {
      showToast("This project name is already in the list.", "error");
      return;
    }
    setLinkPendingLinks((current) => [...current, { key, kind: "custom", projectName }]);
    setLinkPicker((current) => ({ ...current, customName: "" }));
  };

  const createCredential = async () => {
    try {
      setSaving(true);
      setError("");
      const { projectIds, customProjectNames } = pendingLinksToPayload(createPendingLinks);
      const created = await apiPost<Credential>("/credentials", {
        name: createForm.name,
        provider: createForm.provider || null,
        envKey: createForm.envKey || null,
        validityDays: createForm.validityDays.trim() ? Number(createForm.validityDays) : null,
        expiresAt: createForm.expiresAt.trim() ? createForm.expiresAt : null,
        notes: createForm.notes || null,
        projectIds,
        customProjectNames,
      });
      setItems((cur) => [created, ...cur]);
      setSelectedId(created.id);
      setCreateForm({
        name: "",
        provider: "",
        envKey: "",
        validityDays: "90",
        expiresAt: "",
        notes: "",
      });
      setCreatePicker(EMPTY_PICKER);
      setCreatePendingLinks([]);
      showToast("Credential added with project links.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add credential", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveCredentialEdits = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      const updated = await apiPut<Credential>(`/credentials/${selected.id}`, {
        name: editForm.name,
        provider: editForm.provider || null,
        envKey: editForm.envKey || null,
        validityDays: editForm.validityDays.trim() ? Number(editForm.validityDays) : null,
        expiresAt: editForm.expiresAt.trim() ? editForm.expiresAt : null,
        notes: editForm.notes || null,
      });
      setItems((cur) => cur.map((x) => (x.id === selected.id ? updated : x)));
      showToast("Credential updated.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update credential", "error");
    } finally {
      setSaving(false);
    }
  };

  const rotateCredential = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      const updated = await apiPut<Credential>(`/credentials/${selected.id}`, {
        rotatedAt: new Date().toISOString(),
      });
      setItems((cur) => cur.map((x) => (x.id === selected.id ? updated : x)));
      showToast("Credential marked as rotated.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to rotate credential", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteCredential = async (id: string) => {
    if (!window.confirm("Delete this credential? This will also remove its usage links.")) return;
    try {
      setSaving(true);
      await apiDelete(`/credentials/${id}`);
      setItems((cur) => cur.filter((x) => x.id !== id));
      if (selectedId === id) setSelectedId("");
      showToast("Credential deleted.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete credential", "error");
    } finally {
      setSaving(false);
    }
  };

  const linkProjects = async (credentialId: string) => {
    const { projectIds, customProjectNames } = pendingLinksToPayload(linkPendingLinks);
    if (!projectIds.length && !customProjectNames.length) {
      showToast("Add at least one project using the dropdown or custom name field.", "error");
      return;
    }
    try {
      setSaving(true);
      const updated = await apiPost<Credential>(`/credentials/${credentialId}/usages/bulk`, {
        projectIds,
        customProjectNames,
        environment: linkDraft.environment || "PROD",
        envKey: linkDraft.envKey || null,
        notes: linkDraft.notes || null,
      });
      setItems((cur) => cur.map((x) => (x.id === credentialId ? updated : x)));
      setLinkPendingLinks([]);
      setLinkPicker(EMPTY_PICKER);
      setLinkDraft({
        environment: "PROD",
        envKey: "",
        notes: "",
      });
      showToast("Projects linked to credential.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to link projects", "error");
    } finally {
      setSaving(false);
    }
  };

  const removeUsage = async (credentialId: string, usageId: string) => {
    if (!window.confirm("Remove this project link?")) return;
    try {
      setSaving(true);
      const updated = await apiDelete<Credential>(`/credentials/${credentialId}/usages/${usageId}`);
      setItems((cur) => cur.map((x) => (x.id === credentialId ? updated : x)));
      showToast("Project link removed.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove project link", "error");
    } finally {
      setSaving(false);
    }
  };

  const sessionGate = renderSessionGate({
    loading: sessionLoading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading credentials",
    loadingDescription: "Preparing the credentials registry.",
  });

  const counts = useMemo(() => {
    return {
      total: items.length,
      expired: items.filter((x) => x.status === "EXPIRED").length,
      expiringSoon: items.filter((x) => x.status === "EXPIRING_SOON").length,
      unknown: items.filter((x) => x.status === "UNKNOWN").length,
      withoutProjects: items.filter((x) => !(x.usages?.length ?? 0)).length,
    };
  }, [items]);

  const actionRequired = useMemo(
    () => items.filter((item) => item.status === "EXPIRED" || item.status === "EXPIRING_SOON"),
    [items]
  );

  return {
    user,
    loading,
    error,
    saving,
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
    credentialProjectNames,
    reload: load,
  };
}
