"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CRMShell } from "@/components/layout/crm-shell";
import { StatePanel } from "@/components/shared/state-panel";
import { renderSessionGate } from "@/components/shared/session-gate";
import { useSession } from "@/hooks/use-session";
import { apiGet, apiPut } from "@/lib/api";
import { EmployeesSkeleton } from "@/components/shared/skeleton";
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
        showToast(err instanceof Error ? err.message : "Failed to load profile", "error");
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
      showToast(err instanceof Error ? err.message : "Failed to update profile", "error");
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
      <div className="min-w-0 space-y-3 sm:space-y-4 overflow-x-hidden pb-4">
        {/* Teams-style Segmented Tabs */}
        <div className="flex h-10 items-center gap-1 overflow-x-auto no-scrollbar rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 text-xs shadow-xs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={settingsTab === "profile"}
            onClick={() => setSettingsTab("profile")}
            className={`flex h-8 items-center whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors ${
              settingsTab === "profile"
                ? "bg-[var(--accent)] text-white shadow-xs"
                : "text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)]"
            }`}
          >
            My Profile
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={settingsTab === "legal"}
            onClick={() => setSettingsTab("legal")}
            className={`flex h-8 items-center whitespace-nowrap rounded-lg px-3.5 text-xs font-semibold transition-colors ${
              settingsTab === "legal"
                ? "bg-[var(--accent)] text-white shadow-xs"
                : "text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-main)]"
            }`}
          >
            Legal & Policies
          </button>
        </div>

        {settingsTab === "legal" ? (
          <section
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs"
          >
            <div>
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-[var(--accent)] border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                Compliance
              </span>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl">Privacy & Terms</h2>
              <p className="mt-0.5 text-xs text-[var(--text-soft)]">
                Review how we handle your data and the policies for using Planitt CRM.
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link
                href="/privacy-policy"
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition-colors hover:border-[var(--accent)] shadow-xs"
              >
                <p className="text-xs font-semibold text-[var(--text-soft)]">Privacy</p>
                <p className="mt-1 text-sm font-bold text-[var(--text-main)]">Privacy Policy</p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">Data collection, use, retention, and your rights.</p>
                <p className="mt-3 text-xs font-semibold text-[var(--accent)]">Read document →</p>
              </Link>
              <Link
                href="/terms-of-service"
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition-colors hover:border-[var(--accent)] shadow-xs"
              >
                <p className="text-xs font-semibold text-[var(--text-soft)]">Terms</p>
                <p className="mt-1 text-sm font-bold text-[var(--text-main)]">Terms of Service</p>
                <p className="mt-1 text-xs text-[var(--text-soft)]">Acceptable use, billing, liability, and governance.</p>
                <p className="mt-3 text-xs font-semibold text-[var(--accent)]">Read document →</p>
              </Link>
            </div>
          </section>
        ) : null}

        {settingsTab === "profile" ? (
          <>
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs">
              <div>
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-[var(--accent)] border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                  Account
                </span>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl">Profile Settings</h2>
                <p className="mt-0.5 text-xs text-[var(--text-soft)]">
                  Update your account name, professional title, and access credentials.
                </p>
              </div>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 shadow-xs">
                  <p className="text-[10px] text-[var(--text-faint)]">Role</p>
                  <p className="mt-0.5 text-sm font-bold text-[var(--text-main)]">{user.role}</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 shadow-xs">
                  <p className="text-[10px] text-[var(--text-faint)]">Profile Completeness</p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-600">{profileCompleteness}%</p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 shadow-xs">
                  <p className="text-[10px] text-[var(--text-faint)]">Session Security</p>
                  <p className="mt-0.5 text-sm font-bold text-[var(--text-main)]">HttpOnly Cookie</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-[var(--text-soft)] mb-1 block">Full Name</label>
                    <input
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[var(--text-soft)] mb-1 block">Designation</label>
                    <input
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                      value={form.designation}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, designation: event.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-[var(--text-soft)] mb-1 block">New Password (optional)</label>
                    <input
                      type="password"
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                      placeholder="Leave empty to keep current password"
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 shadow-xs">
                    <p className="text-xs font-semibold text-[var(--text-main)]">Email Policy</p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                      Your email cannot be changed from this page.
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-soft)]">{emailPolicyMessage}</p>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 shadow-xs">
                    <p className="text-xs font-semibold text-[var(--text-main)]">Current Email</p>
                    <p className="mt-1 text-xs font-medium text-[var(--text-main)]">{profile.email}</p>
                  </div>
                </div>
              </div>

              {error ? <p className="mt-3 text-xs font-medium text-rose-600">{error}</p> : null}
              {notice ? <p className="mt-3 text-xs font-medium text-emerald-600">{notice}</p> : null}

              <div className="mt-5 border-t border-[var(--border)] pt-4">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveProfile()}
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-strong)] px-4 text-xs font-semibold text-white shadow-xs transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </CRMShell>
  );
}
