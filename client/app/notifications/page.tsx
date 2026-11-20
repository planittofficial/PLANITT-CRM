"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CRMShell } from "@/components/layout/crm-shell";
import { renderSessionGate } from "@/components/shared/session-gate";
import { useSession } from "@/hooks/use-session";
import {
  type NotificationPreferences,
  useNotificationsBackend,
} from "@/hooks/use-notifications-backend";
import {
  ArrowLeftIcon,
  BellIcon,
  CheckIcon,
  SettingsIcon,
} from "@/components/ui/icons";
import { Skeleton } from "@/components/shared/skeleton";

type FilterType = "all" | "unread";

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: sessionLoading, error: sessionError, retry: retrySession } = useSession();
  const [filter, setFilter] = useState<FilterType>("all");

  const sessionGate = renderSessionGate({
    loading: sessionLoading,
    user,
    error: sessionError,
    retry: retrySession,
    loadingTitle: "Loading notifications",
    loadingDescription: "Preparing your notification center.",
  });

  if (sessionGate) return sessionGate;
  if (!user) return null;

  return (
    <CRMShell user={user}>
      <NotificationsContent user={user} filter={filter} setFilter={setFilter} />
    </CRMShell>
  );
}

function NotificationsContent({
  user,
  filter,
  setFilter,
}: {
  user: any;
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
}) {
  const router = useRouter();
  const [showPreferences, setShowPreferences] = useState(false);
  const {
    items,
    unreadCount,
    markRead,
    markAllRead,
    clearAll,
    loading,
    preferences,
    updatePreferences,
  } = useNotificationsBackend(user);

  const filteredItems = useMemo(() => {
    if (filter === "unread") {
      return items.filter((item) => !item.read);
    }
    return items;
  }, [items, filter]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, typeof filteredItems>();
    for (const item of filteredItems) {
      const day = new Date(item.createdAt).toDateString();
      const key = item.groupKey ? `${day}:${item.groupKey}` : item.id;
      const current = groups.get(key) ?? [];
      groups.set(key, [...current, item]);
    }
    return Array.from(groups.values()).map((group) => ({
      ...group[0],
      groupCount: group.length,
    }));
  }, [filteredItems]);

  const priorityBadgeStyle = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30";
      case "HIGH":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30";
      case "MEDIUM":
        return "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30";
      case "LOW":
      default:
        return "bg-[var(--surface-soft)] text-[var(--text-soft)] border border-[var(--border)]";
    }
  };

  const preferenceRows: Array<{
    key: Exclude<keyof NotificationPreferences, "role">;
    label: string;
  }> = [
    { key: "tasksAssigned", label: "Task assignments" },
    { key: "tasksUpdated", label: "Task updates" },
    { key: "taskProgress", label: "Task progress" },
    { key: "issueReported", label: "Issue reports" },
    { key: "issueResponse", label: "Issue responses" },
    { key: "projectUpdates", label: "Project updates" },
    { key: "attendanceAlerts", label: "Attendance alerts" },
    { key: "chatMentions", label: "Chat mentions" },
    { key: "leaveRequests", label: "Leave requests" },
    { key: "credentialAlerts", label: "Credential expiry alerts" },
  ];

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4 overflow-x-hidden pb-4">
      {/* Top Header Card */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {/* Back Button */}
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs font-semibold text-[var(--text-main)] hover:bg-[var(--surface-hover)] hover:border-[var(--accent)] transition-colors shadow-xs"
              title="Go back"
            >
              <ArrowLeftIcon size={14} />
              <span>Back</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md crm-gold-badge px-2 py-0.5 text-xs font-semibold">
                  Alerts & Activity
                </span>
                <span className="text-xs text-[var(--text-soft)]">Notification Center</span>
              </div>
              <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-main)]">
                Notifications
              </h1>
              <p className="mt-0.5 text-xs text-[var(--text-soft)]">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "All caught up! No unread notifications."}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreferences(!showPreferences)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors shadow-xs ${
                showPreferences
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text-main)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <SettingsIcon size={14} />
              <span>{showPreferences ? "Hide Settings" : "Preferences"}</span>
            </button>

            {items.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={markAllRead}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 text-xs font-semibold text-[var(--text-soft)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] transition-colors shadow-xs"
                >
                  <CheckIcon size={14} />
                  <span>Mark all read</span>
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex h-9 items-center rounded-lg border border-rose-200 bg-rose-50/50 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-100/60 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400 transition-colors shadow-xs"
                >
                  Clear all
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Preferences Drawer / Accordion */}
      {showPreferences && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5 shadow-xs animate-in fade-in duration-150">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">Notification Preferences</h3>
              <p className="mt-0.5 text-xs text-[var(--text-soft)]">
                Choose which events trigger notification alerts for your account.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {preferenceRows.map((row) => {
              const checked = preferences?.[row.key] ?? true;
              return (
                <label
                  key={row.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-medium text-[var(--text-soft)] cursor-pointer hover:border-[var(--accent)]/50 transition-colors"
                >
                  <span>{row.label}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => updatePreferences({ [row.key]: event.target.checked })}
                    className="h-4 w-4 rounded accent-[var(--accent)] cursor-pointer"
                  />
                </label>
              );
            })}
          </div>
        </section>
      )}

      {/* Notification List Section */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5 shadow-xs space-y-3">
        {/* Filter Tabs Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <div className="flex h-9 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`flex h-7 items-center rounded-md px-3 font-semibold transition-colors ${
                filter === "all"
                  ? "bg-[var(--surface)] text-[var(--accent)] shadow-xs"
                  : "text-[var(--text-soft)] hover:text-[var(--text-main)]"
              }`}
            >
              All ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`flex h-7 items-center rounded-md px-3 font-semibold transition-colors ${
                filter === "unread"
                  ? "bg-[var(--surface)] text-[var(--accent)] shadow-xs"
                  : "text-[var(--text-soft)] hover:text-[var(--text-main)]"
              }`}
            >
              Unread {unreadCount > 0 ? `(${unreadCount})` : "(0)"}
            </button>
          </div>

          <span className="text-xs text-[var(--text-soft)] font-medium">
            {filteredItems.length} {filteredItems.length === 1 ? "notification" : "notifications"}
          </span>
        </div>

        {/* Loading Skeletons */}
        {loading && items.length === 0 ? (
          <div className="space-y-2.5 py-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3.5 space-y-2">
                <Skeleton className="h-4 w-48 rounded" />
                <Skeleton className="h-3 w-full rounded" />
                <div className="flex gap-2">
                  <Skeleton className="h-3.5 w-16 rounded" />
                  <Skeleton className="h-3.5 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : groupedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-soft)] border border-[var(--border)] text-[var(--text-faint)] mb-3">
              <BellIcon size={22} />
            </div>
            <p className="text-sm font-bold text-[var(--text-main)]">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p className="mt-1 text-xs text-[var(--text-soft)] max-w-sm">
              {filter === "unread"
                ? "You're all caught up! Switch to 'All' to review earlier notifications."
                : "You don't have any activity or alerts yet. Tasks, mentions, and updates will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {groupedItems.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className="w-full rounded-xl border border-[var(--border)] p-3.5 text-left transition hover:border-[var(--accent)]/60 shadow-xs cursor-pointer"
                style={{
                  background: notification.read ? "var(--surface)" : "var(--surface-soft)",
                }}
                onClick={() => {
                  markRead(notification.id);
                  if (notification.href) {
                    router.push(notification.href);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs sm:text-sm font-bold text-[var(--text-main)] truncate">
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="h-2 w-2 rounded-full bg-[var(--accent)] shrink-0" title="Unread" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-soft)] line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      {notification.groupCount > 1 ? (
                        <span className="inline-block rounded-md bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-soft)]">
                          {notification.groupCount} grouped
                        </span>
                      ) : null}
                      <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${priorityBadgeStyle(notification.priority)}`}>
                        {notification.priority}
                      </span>
                      <span className="text-[10px] text-[var(--text-faint)]">
                        {new Date(notification.createdAt).toLocaleString()}
                      </span>
                      {notification.href && (
                        <span className="text-[10px] font-semibold text-[var(--accent)] hover:underline ml-auto">
                          View details →
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
