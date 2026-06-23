"use client";

import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { useSession } from "@/hooks/use-session";
import { renderSessionGate } from "@/components/shared/session-gate";
import type { Credential, Project } from "@/types/crm";
import { showToast } from "./use-toast";

type UsageDraft = {
  projectId: string;
  environment: string;
  envKey: string;
  notes: string;
};

const EMPTY_USAGE: UsageDraft = { projectId: "", environment: "PROD", envKey: "", notes: "" };

export function useCredentialsData() {
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession({
    allowedRoles: ["SUPERADMIN", "ADMIN", "MANAGER"],
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

  const [usageDraft, setUsageDraft] = useState<UsageDraft>(EMPTY_USAGE);

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

  const createCredential = async () => {
    try {
      setSaving(true);
      setError("");
      const payload = {
        name: createForm.name,
        provider: createForm.provider || null,
        envKey: createForm.envKey || null,
        validityDays: createForm.validityDays.trim() ? Number(createForm.validityDays) : null,
        expiresAt: createForm.expiresAt.trim() ? createForm.expiresAt : null,
        notes: createForm.notes || null,
      };
      const created = await apiPost<Credential>("/credentials", payload);
      setItems((cur) => [created, ...cur]);
      setSelectedId(created.id);
      setCreateForm({ name: "", provider: "", envKey: "", validityDays: "90", expiresAt: "", notes: "" });
      showToast("Credential added.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add credential", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateCredential = async (id: string, patch: Partial<Credential>) => {
    try {
      setSaving(true);
      const updated = await apiPut<Credential>(`/credentials/${id}`, patch);
      setItems((cur) => cur.map((x) => (x.id === id ? updated : x)));
      showToast("Credential updated.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update credential", "error");
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

  const addUsage = async (credentialId: string) => {
    try {
      setSaving(true);
      const updated = await apiPost<Credential>(`/credentials/${credentialId}/usages`, {
        projectId: usageDraft.projectId,
        environment: usageDraft.environment || null,
        envKey: usageDraft.envKey || null,
        notes: usageDraft.notes || null,
      });
      setItems((cur) => cur.map((x) => (x.id === credentialId ? updated : x)));
      setUsageDraft(EMPTY_USAGE);
      showToast("Usage linked to project.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to link usage", "error");
    } finally {
      setSaving(false);
    }
  };

  const removeUsage = async (credentialId: string, usageId: string) => {
    if (!window.confirm("Remove this usage link?")) return;
    try {
      setSaving(true);
      const updated = await apiDelete<Credential>(`/credentials/${credentialId}/usages/${usageId}`);
      setItems((cur) => cur.map((x) => (x.id === credentialId ? updated : x)));
      showToast("Usage removed.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove usage", "error");
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
    };
  }, [items]);

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
    createForm,
    setCreateForm,
    usageDraft,
    setUsageDraft,
    createCredential,
    updateCredential,
    deleteCredential,
    addUsage,
    removeUsage,
    reload: load,
  };
}

