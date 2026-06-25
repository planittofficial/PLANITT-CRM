"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CRMShell } from "@/components/layout/crm-shell";
import { renderSessionGate } from "@/components/shared/session-gate";
import { EmployeesSkeleton } from "@/components/shared/skeleton";
import { useSession } from "@/hooks/use-session";
import { apiGet, apiPost } from "@/lib/api";
import { showToast } from "@/hooks/use-toast";
import { ChecklistProgressRing } from "@/components/checklist/checklist-progress-ring";
import { ChecklistSummaryCards } from "@/components/checklist/checklist-summary-cards";
import { ChecklistCategoryCard } from "@/components/checklist/checklist-category-card";
import { ChecklistActivityFeed } from "@/components/checklist/checklist-activity-feed";
import type { ChecklistEmployeeDetail } from "@/types/crm";

export default function ChecklistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params?.employeeId as string;

  const {
    user,
    loading: sessionLoading,
    error: sessionError,
    retry: retrySession,
  } = useSession({ allowedRoles: ["SUPERADMIN", "ADMIN"] });

  const [data, setData] = useState<ChecklistEmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [resetting, setResetting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      const result = await apiGet<ChecklistEmployeeDetail>(`/checklist/${employeeId}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load checklist");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (!user) return;
    // ADMIN can only view their own checklist
    if (user.role === "ADMIN" && user.id !== employeeId) {
      router.replace(`/checklist/${user.id}`);
      return;
    }
    void loadData();
  }, [user, employeeId, router, loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    void loadData();
  }, [loadData]);

  const handleReset = async () => {
    if (!window.confirm("Reset all checklist items to Pending? This cannot be undone.")) return;
    try {
      setResetting(true);
      await apiPost(`/checklist/${employeeId}/reset`);
      handleRefresh();
      showToast("Checklist reset successfully", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to reset", "error");
    } finally {
      setResetting(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await apiPost("/checklist/categories", { name: newCategoryName.trim() });
      setNewCategoryName("");
      setAddingCategory(false);
      handleRefresh();
      showToast("Category created", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create category", "error");
    }
  };

  const sessionGate = renderSessionGate({
    loading: sessionLoading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading checklist",
    loadingDescription: "Preparing employee document checklist.",
  });

  if (sessionGate) return sessionGate;
  if (!user) return null;

  if (loading && !data) {
    return (
      <CRMShell user={user}>
        <EmployeesSkeleton />
      </CRMShell>
    );
  }

  if (error && !data) {
    return (
      <CRMShell user={user}>
        <div className="flex flex-col items-center justify-center py-24">
          <p className="text-sm text-red-500">{error}</p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--accent-strong)" }}
          >
            Try again
          </button>
        </div>
      </CRMShell>
    );
  }

  if (!data) return null;

  const { employee, categories } = data;
  const isSuperAdmin = user.role === "SUPERADMIN";

  function initials(name: string) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }

  return (
    <CRMShell user={user}>
      <div className="min-w-0 space-y-4 overflow-x-hidden pb-4">
        {/* Back + Header */}
        <section
          className="rounded-[20px] border p-5"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          {isSuperAdmin ? (
            <Link
              href="/checklist"
              className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-strong)] hover:underline"
            >
              ← Back to all admins
            </Link>
          ) : null}

          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            {/* Employee Info */}
            <div className="flex items-center gap-4">
              {employee.avatarUrl && employee.authProvider === "google" ? (
                <img
                  src={employee.avatarUrl}
                  alt={employee.name}
                  className="h-16 w-16 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="crm-avatar flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white">
                  {initials(employee.name)}
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-[var(--text-main)]">{employee.name}</h1>
                <p className="mt-0.5 text-sm text-[var(--text-soft)]">
                  {employee.designation ?? employee.role}
                </p>
                {employee.department ? (
                  <span
                    className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                      color: "var(--accent-strong)",
                    }}
                  >
                    {employee.department.name}
                  </span>
                ) : null}
                {employee.createdAt ? (
                  <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                    Joined{" "}
                    {new Date(employee.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Progress Ring + Actions */}
            <div className="flex items-center gap-5">
              <ChecklistProgressRing
                percent={employee.completionPercent}
                size={80}
                strokeWidth={7}
                label="Overall"
              />
              {isSuperAdmin ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setAddingCategory(true)}
                    className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-500"
                  >
                    + Category
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={resetting}
                    className="rounded-xl border px-4 py-2.5 text-xs font-semibold transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
                    style={{ borderColor: "var(--border)", color: "var(--danger)" }}
                  >
                    {resetting ? "Resetting..." : "Reset All"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Summary Cards */}
        <ChecklistSummaryCards
          completed={employee.completedItems}
          pending={employee.totalItems - employee.completedItems}
          total={employee.totalItems}
          percent={employee.completionPercent}
        />

        {/* Category Progress Overview */}
        <section
          className="rounded-[20px] border p-5"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          <h2 className="mb-4 text-sm font-semibold text-[var(--text-main)]">
            Category Progress
          </h2>
          <div className="space-y-3">
            {categories.map((cat) => {
              const catPercent =
                cat.totalItems > 0 ? Math.round((cat.completedItems / cat.totalItems) * 100) : 0;
              return (
                <div key={cat.id}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--text-main)]">{cat.name}</span>
                    <span className="font-semibold" style={{ color: catPercent >= 100 ? "var(--success)" : "var(--accent)" }}>
                      {catPercent}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${catPercent}%`,
                        background:
                          catPercent >= 100
                            ? "var(--success)"
                            : "linear-gradient(90deg, var(--accent), var(--accent-alt))",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Add Category Form */}
        {addingCategory && isSuperAdmin ? (
          <section
            className="rounded-[20px] border p-5"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            <h3 className="mb-3 text-sm font-semibold text-[var(--text-main)]">
              New Category
            </h3>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newCategoryName}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setNewCategoryName(e.target.value)
                }
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                className="crm-input h-10 flex-1 rounded-xl px-3 text-sm"
                placeholder="Category name..."
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-500"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingCategory(false);
                  setNewCategoryName("");
                }}
                className="rounded-xl px-4 py-2.5 text-xs font-semibold text-[var(--text-faint)]"
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        {/* Checklist Categories + Activity Feed */}
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          {/* Categories */}
          <div className="space-y-4">
            {categories.length === 0 ? (
              <div
                className="rounded-[20px] border px-5 py-12 text-center"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <p className="text-sm text-[var(--text-soft)]">
                  No checklist categories yet.
                  {isSuperAdmin
                    ? " Click '+ Category' above to create one."
                    : " Your Super Admin will set up your checklist."}
                </p>
              </div>
            ) : (
              categories.map((cat) => (
                <ChecklistCategoryCard
                  key={cat.id}
                  category={cat}
                  employeeId={employeeId}
                  currentUserRole={user.role}
                  onRefresh={handleRefresh}
                />
              ))
            )}
          </div>

          {/* Activity Feed — only visible to Super Admin */}
          {isSuperAdmin ? (
            <div className="hidden xl:block">
              <ChecklistActivityFeed employeeId={employeeId} refreshKey={refreshKey} />
            </div>
          ) : null}
        </div>

        {/* Activity Feed on mobile / smaller screens */}
        {isSuperAdmin ? (
          <div className="xl:hidden">
            <ChecklistActivityFeed employeeId={employeeId} refreshKey={refreshKey} />
          </div>
        ) : null}
      </div>
    </CRMShell>
  );
}
