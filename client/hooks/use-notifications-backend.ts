"use client";

import { useEffect, useMemo, useState } from "react";
import { useSocket } from "@/components/providers/socket-provider";
import { apiGet, apiPatch, apiDelete } from "@/lib/api";
import type { CRMUser } from "@/types/crm";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  updatedAt?: string;
  read: boolean;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  type: string;
  taskId?: string;
  projectId?: string;
  issueId?: string;
  actorId?: string;
  groupKey?: string | null;
};

export type NotificationPreferences = {
  role?: "SUPERADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE" | "INTERN";
  tasksAssigned: boolean;
  tasksUpdated: boolean;
  taskProgress: boolean;
  taskOverdue: boolean;
  taskMentions: boolean;
  issueReported: boolean;
  issueResponse: boolean;
  projectUpdates: boolean;
  attendanceAlerts: boolean;
  chatMentions: boolean;
  leaveRequests: boolean;
  credentialAlerts: boolean;
};

export function useNotificationsBackend(user: CRMUser) {
  const { socket } = useSocket();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastPushedId, setLastPushedId] = useState<string>("");
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

  // Fetch initial notifications
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const data = await apiGet<{
          notifications: NotificationItem[];
          total: number;
        }>("/notifications");

        if (data?.notifications) {
          setItems(data.notifications);
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchNotifications();
  }, [user.id]);

  useEffect(() => {
    async function fetchInitialMeta() {
      try {
        const [countData, preferenceData] = await Promise.all([
          apiGet<{ unreadCount: number }>("/notifications/unread-count"),
          apiGet<NotificationPreferences>("/notifications/preferences"),
        ]);
        if (typeof countData?.unreadCount === "number") {
          setUnreadCount(countData.unreadCount);
        }
        setPreferences(preferenceData);
      } catch (error) {
        console.error("Error fetching notification metadata:", error);
      }
    }

    fetchInitialMeta();
  }, [user.id]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.emit("crm:join", {});

    const handleNewNotification = (notification: NotificationItem) => {
      setItems((current) => {
        const existing = current.find((item) => item.id === notification.id);
        if (!notification.read && (!existing || existing.read)) {
          setUnreadCount((prev) => prev + 1);
        }
        const withoutExisting = current.filter((item) => item.id !== notification.id);
        return [notification, ...withoutExisting].slice(0, 100);
      });
      setLastPushedId(notification.id);
    };

    socket.on("notification:new", handleNewNotification);

    const handleRead = (payload: { ids: string[]; all?: boolean }) => {
      if (payload?.all) {
        setItems((current) => current.map((it) => ({ ...it, read: true })));
        setUnreadCount(0);
        return;
      }
      if (!payload || !Array.isArray(payload.ids)) return;
      const idsSet = new Set(payload.ids);
      setItems((current) => current.map((it) => (idsSet.has(it.id) ? { ...it, read: true } : it)));
      setUnreadCount((prev) => Math.max(0, prev - payload.ids.length));
    };

    const handleDeleted = (payload: { ids: string[]; all?: boolean }) => {
      if (payload?.all) {
        setItems([]);
        setUnreadCount(0);
        return;
      }
      if (!payload || !Array.isArray(payload.ids)) return;
      const idsSet = new Set(payload.ids);
      setItems((current) => current.filter((it) => !idsSet.has(it.id)));
    };

    const handleUnreadCount = (payload: { unreadCount: number }) => {
      if (!payload || typeof payload.unreadCount !== "number") return;
      setUnreadCount(payload.unreadCount);
    };

    socket.on("notification:read", handleRead);
    socket.on("notification:deleted", handleDeleted);
    socket.on("notification:unread-count", handleUnreadCount);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("notification:read", handleRead);
      socket.off("notification:deleted", handleDeleted);
      socket.off("notification:unread-count", handleUnreadCount);
    };
  }, [socket]);

  const markRead = async (notificationId: string) => {
    try {
      await apiPatch(`/notifications/${notificationId}/read`, {});

      setItems((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, read: true } : item
        )
      );

      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllRead = async () => {
    try {
      await apiPatch("/notifications/read-all", {});

      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const clearAll = async () => {
    try {
      await apiDelete("/notifications");

      setItems([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    try {
      const updated = await apiPatch<NotificationPreferences>("/notifications/preferences", updates);
      setPreferences(updated);
      return updated;
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      throw error;
    }
  };

  const latestItem = useMemo(() => items[0] ?? null, [items]);

  return {
    items,
    unreadCount,
    lastPushedId,
    markRead,
    markAllRead,
    clearAll,
    preferences,
    updatePreferences,
    loading,
    latestItem,
  };
}
