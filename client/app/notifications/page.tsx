"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import {
  type NotificationPreferences,
  useNotificationsBackend,
} from "@/hooks/use-notifications-backend";

type FilterType = "all" | "unread";

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useSession();
  const [filter, setFilter] = useState<FilterType>("all");

  if (userLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-[var(--text-soft)]">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-[var(--text-soft)]">Unauthorized</div>
      </div>
    );
  }

  return <NotificationsContent user={user} filter={filter} setFilter={setFilter} />;
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

  const priorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-rose-500 text-white";
      case "HIGH":
        return "bg-amber-500 text-white";
      case "MEDIUM":
        return "bg-sky-500 text-white";
      case "LOW":
      default:
        return "bg-[var(--surface)] text-[var(--text-soft)] border border-[var(--border)]";
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

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-[var(--accent)] border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
                Alerts & Activity
              </span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-[var(--text-main)]">Notification Center</h2>
            <p className="mt-0.5 text-xs text-[var(--text-soft)]">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "All caught up!"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                All
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
                Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
              </button>
            </div>
            {items.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={markAllRead}
                  className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text-soft)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] transition-colors shadow-xs"
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="h-9 rounded-lg border border-rose-200 bg-rose-50/50 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-100/60 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400 transition-colors shadow-xs"
                >
                  Clear all
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-main)]">Preferences</h3>
            <p className="mt-0.5 text-xs text-[var(--text-soft)]">
              These settings sync to your {preferences?.role ? preferences.role.toLowerCase() : "user"} account.
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
      </div>

      <div className="space-y-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-5 shadow-xs">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-xs text-[var(--text-soft)]">Loading notifications...</div>
          </div>
        ) : groupedItems.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-xs text-[var(--text-soft)]">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </div>
          </div>
        ) : (
          groupedItems.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className="w-full rounded-xl border border-[var(--border)] p-3.5 text-left transition hover:border-[var(--accent)]/60 shadow-xs"
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
                    <p className="text-xs font-bold text-[var(--text-main)] truncate">{notification.title}</p>
                    {!notification.read && (
                      <span className="h-2 w-2 rounded-full bg-[var(--accent)] shrink-0" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-soft)] line-clamp-2">{notification.message}</p>
                  <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                    {notification.groupCount > 1 ? (
                      <span className="inline-block rounded-md bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-soft)]">
                        {notification.groupCount} grouped
                      </span>
                    ) : null}
                    <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${priorityColor(notification.priority)}`}>
                      {notification.priority}
                    </span>
                    <span className="text-[10px] text-[var(--text-faint)]">
                      {new Date(notification.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
