"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CRMShell } from "@/components/layout/crm-shell";
import { StatePanel } from "@/components/shared/state-panel";
import { renderSessionGate } from "@/components/shared/session-gate";
import { useSession } from "@/hooks/use-session";
import { apiGet, apiPut } from "@/lib/api";
import { EmployeesSkeleton} from "@/components/shared/skeleton";

import type { CRMUser } from "@/types/crm";
import { showToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { user, loading, error: sessionError, retry: retrySession } = useSession();
  const [profile, setProfile] = useState<CRMUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [settingsTab, setSettingsTab] = useState<"profile" | "legal">("profile");
  const [form, setForm] = useState({
    name: "",
    designation: "",
    password: "",
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await apiGet<CRMUser>("/users/me");
        setProfile(data);
        setForm({
          name: data.name ?? "",
          designation: data.designation ?? "",
          password: "",
        });
      } catch (err) { setError(err instanceof Error ? err.message : "Failed to load profile");
        showToast(err instanceof Error ? err.message : "Failed to load profile" , "error");
      }
    }

    if (user) {
      void loadProfile();
    }
  }, [user]);

  const saveProfile = async () => {
    try {
      setSaving(true);
      setError("");
      setNotice("");
      const updated = await apiPut<CRMUser>("/users/me/profile", {
        name: form.name,
        designation: form.designation,
        ...(form.password.trim() ? { password: form.password } : {}),
      });
      setProfile(updated);
      setForm((current) => ({ ...current, password: "" }));
      showToast("Profile updated successfully.", "success");
    } catch (err) { 
      showToast(err instanceof Error ? err.message : "Failed to update profile" , "error");
    } finally {
      setSaving(false);
    }
  };

  const sessionGate = renderSessionGate({
    loading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading settings",
    loadingDescription: "Preparing your account settings.",
  });
  if (sessionGate) {
    return sessionGate;
  }

  if (!user) {
    return null;
  }
   if (loading) {
    return (
      <CRMShell user={user}>
        <EmployeesSkeleton />
      </CRMShell>
    );
  }

  if (!profile) {
    return (
      <CRMShell user={user}>
        <StatePanel title="Profile unavailable" description={error || "Unable to load profile details."} />
      </CRMShell>
    );
  }

  const emailPolicyMessage =
    user.role === "SUPERADMIN"
      ? "As Superadmin (CEO), you can change team emails from Team Management. Your own email is locked here to avoid accidental account lockout."
      : "Contact your manager, admin, or superadmin for email changes.";
  const profileCompleteness = Math.round(
    ([
      Boolean(form.name.trim()),
      Boolean(form.designation.trim()),
      Boolean(profile.email.trim()),
    ].filter(Boolean).length /
      3) *
      100
  );

  return (
    <CRMShell user={user}>
      <div className="min-w-0 space-y-4 overflow-x-hidden pb-4">
        <div
          className="inline-flex rounded-2xl border p-1"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
          role="tablist"
          aria-label="Settings sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={settingsTab === "profile"}
            onClick={() => setSettingsTab("profile")}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition sm:px-5"
            style={
              settingsTab === "profile"
                ? { background: "var(--surface-strong)", color: "var(--text-main)", boxShadow: "var(--shadow-card)" }
                : { color: "var(--text-soft)" }
            }
          >
            Profile
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={settingsTab === "legal"}
            onClick={() => setSettingsTab("legal")}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition sm:px-5"
            style={
              settingsTab === "legal"
                ? { background: "var(--surface-strong)", color: "var(--text-main)", boxShadow: "var(--shadow-card)" }
                : { color: "var(--text-soft)" }
            }
          >
            Legal
          </button>
        </div>

        {settingsTab === "legal" ? (
          <section
            className="rounded-[20px] border px-5 py-5"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
              Legal &amp; policies
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--text-main)]">Privacy &amp; terms</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-soft)]">
              Review how we handle your data and the rules for using Planitt CRM. These documents open in full on separate
              pages.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Link
                href="/privacy-policy"
                className="rounded-2xl border px-5 py-5 transition hover:border-[var(--accent)]"
                style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">Privacy</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">Privacy Policy</p>
                <p className="mt-2 text-sm text-[var(--text-soft)]">Data collection, use, retention, and your rights.</p>
                <p className="mt-4 text-sm font-semibold text-[var(--accent)]">Read document →</p>
              </Link>
              <Link
                href="/terms-of-service"
                className="rounded-2xl border px-5 py-5 transition hover:border-[var(--accent)]"
                style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">Terms</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">Terms of Service</p>
                <p className="mt-2 text-sm text-[var(--text-soft)]">Acceptable use, billing, liability, and disputes.</p>
                <p className="mt-4 text-sm font-semibold text-[var(--accent)]">Read document →</p>
              </Link>
            </div>
          </section>
        ) : null}

        {settingsTab === "profile" ? (
          <>
        <section
          className="rounded-[20px] border px-5 py-5"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
            Account settings
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--text-main)]">Profile</h1>
          <p className="mt-2 text-sm text-[var(--text-soft)]">
            You can update your name, designation, and password here.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Role</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">{user.role}</p>
            </div>
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Profile completeness</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">{profileCompleteness}%</p>
            </div>
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">Session model</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text-main)]">HttpOnly Cookie</p>
            </div>
          </div>
        </section>

        <section
          className="rounded-[20px] border px-5 py-5"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-4">
              <label className="text-sm font-medium text-[var(--text-main)]">
                Full name
                <input
                  className="mt-2 h-12 w-full rounded-2xl border px-4 outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>

              <label className="text-sm font-medium text-[var(--text-main)]">
                Designation
                <input
                  className="mt-2 h-12 w-full rounded-2xl border px-4 outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}
                  value={form.designation}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, designation: event.target.value }))
                  }
                />
              </label>

              <label className="text-sm font-medium text-[var(--text-main)]">
                New password (optional)
                <input
                  type="password"
                  className="mt-2 h-12 w-full rounded-2xl border px-4 outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--surface-soft)", color: "var(--text-main)" }}
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                />
              </label>
            </div>

            <div className="space-y-3">
              <div
                className="rounded-2xl border px-4 py-4"
                style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Email policy
                </p>
                <p className="mt-2 text-sm text-[var(--text-soft)]">
                  Your email cannot be changed from this page.
                </p>
                <p className="mt-2 text-sm text-[var(--text-soft)]">
                  {emailPolicyMessage}
                </p>
              </div>

              <div
                className="rounded-2xl border px-4 py-4"
                style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Current email
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--text-main)]">{profile.email}</p>
              </div>
            </div>
          </div>

          {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
          {notice ? <p className="mt-4 text-sm font-medium text-emerald-600">{notice}</p> : null}

          <button
            type="button"
            disabled={saving}
            onClick={() => void saveProfile()}
            className="mt-6 rounded-2xl px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
            style={{ background: "var(--accent-strong)" }}
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </section>
          </>
        ) : null}
      </div>
    </CRMShell>
  );
}
