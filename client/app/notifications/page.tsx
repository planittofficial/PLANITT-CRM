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
        return "var(--danger)";
      case "HIGH":
        return "#ff9800";
      case "MEDIUM":
        return "#2196f3";
      case "LOW":
      default:
        return "var(--text-faint)";
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
    <div className="space-y-3">
      {/* Header */}
      <div
        className="rounded-lg border p-4"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-main)]">Notification Center</h2>
            <p className="mt-1 text-xs text-[var(--text-faint)]">
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}` : "All caught up!"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                filter === "all"
                  ? "bg-[var(--accent-strong)] text-white"
                  : "border border-[var(--border)] text-[var(--text-soft)] hover:text-[var(--text-main)]"
              }`}
              style={{
                background: filter === "all" ? "var(--accent-strong)" : undefined,
              }}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                filter === "unread"
                  ? "bg-[var(--accent-strong)] text-white"
                  : "border border-[var(--border)] text-[var(--text-soft)] hover:text-[var(--text-main)]"
              }`}
              style={{
                background: filter === "unread" ? "var(--accent-strong)" : undefined,
              }}
            >
              Unread
            </button>
            {items.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={markAllRead}
                  className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-soft)] transition hover:text-[var(--text-main)]"
                >
                  Mark all read
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-md border border-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
                >
                  Clear all
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className="rounded-lg border p-4"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-main)]">Preferences</h3>
            <p className="mt-1 text-xs text-[var(--text-faint)]">
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
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--border)", color: "var(--text-soft)" }}
              >
                <span>{row.label}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => updatePreferences({ [row.key]: event.target.checked })}
                  className="h-4 w-4 accent-[var(--accent-strong)]"
                />
              </label>
            );
          })}
        </div>
      </div>

      <div
        className="space-y-2 rounded-lg border p-4"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-[var(--text-soft)]">Loading notifications...</div>
          </div>
        ) : groupedItems.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-[var(--text-soft)]">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </div>
          </div>
        ) : (
          groupedItems.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className="w-full rounded-md border p-4 text-left transition hover:bg-[var(--surface-soft)]"
              style={{
                borderColor: "var(--border)",
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
                    <p className="font-semibold text-[var(--text-main)]">{notification.title}</p>
                    {!notification.read && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: "var(--accent-strong)" }}
                      />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">{notification.message}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {notification.groupCount > 1 ? (
                      <span
                        className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                        style={{
                          background: "var(--surface)",
                          color: "var(--text-soft)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {notification.groupCount} grouped
                      </span>
                    ) : null}
                    <span
                      className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
                      style={{ background: priorityColor(notification.priority) }}
                    >
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
