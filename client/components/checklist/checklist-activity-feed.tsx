"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { ChecklistActivityResponse, ChecklistActivityItem } from "@/types/crm";

type ActivityFeedProps = {
  employeeId?: string;
  refreshKey?: number;
};

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function ChecklistActivityFeed({ employeeId, refreshKey = 0 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ChecklistActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const query = new URLSearchParams({ limit: "15" });
        if (employeeId) query.set("employeeId", employeeId);
        const data = await apiGet<ChecklistActivityResponse>(
          `/checklist/activity?${query.toString()}`
        );
        setActivities(data.items);
      } catch {
        setActivities([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [employeeId, refreshKey]);

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <h3 className="text-sm font-semibold text-[var(--text-main)]">Recent Activity</h3>

      {loading ? (
        <div className="mt-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-[var(--border)]" />
              <div className="h-3 flex-1 rounded bg-[var(--border)]" />
            </div>
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="mt-4 text-xs text-[var(--text-faint)]">No activity yet.</p>
      ) : (
        <div className="mt-4 space-y-0">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className="relative flex items-start gap-3 pb-4 pl-4"
            >
              {/* Timeline line */}
              {index < activities.length - 1 ? (
                <div
                  className="absolute bottom-0 left-[7px] top-3 w-px"
                  style={{ background: "var(--border)" }}
                />
              ) : null}
              {/* Dot */}
              <div
                className="absolute left-0.5 top-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: "var(--accent)" }}
              />
              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--text-main)]">{activity.action}</p>
                {activity.details ? (
                  <p className="mt-0.5 text-[10px] italic text-[var(--text-soft)]">
                    {activity.details}
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                  {timeAgo(activity.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
