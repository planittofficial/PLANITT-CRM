"use client";

import { useEffect, useMemo, useState } from "react";
import { useSocket } from "@/components/providers/socket-provider";
import type { CRMUser } from "@/types/crm";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  read: boolean;
};

const MAX_NOTIFICATIONS = 40;

function storageKey(userId: string) {
  return `crm-notifications:${userId}`;
}

function createNotificationId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useNotifications(user: CRMUser) {
  const { socket } = useSocket();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [lastPushedId, setLastPushedId] = useState<string>("");

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey(user.id));
    if (!raw) {
      setItems([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as NotificationItem[];
      setItems(Array.isArray(parsed) ? parsed : []);
    } catch {
      setItems([]);
    }
  }, [user.id]);

  useEffect(() => {
    window.localStorage.setItem(storageKey(user.id), JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)));
  }, [items, user.id]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.emit("crm:join", {});

    const push = (notification: Omit<NotificationItem, "id" | "createdAt" | "read">) => {
      const nextId = createNotificationId();
      setItems((current) => [
        {
          id: nextId,
          createdAt: new Date().toISOString(),
          read: false,
          ...notification,
        },
        ...current,
      ]);
      setLastPushedId(nextId);
    };

    const handleTaskUpdated = (payload: any = {}) => {
      if (payload.actorId === user.id) {
        return;
      }

      const taskHref = `/tasks?taskId=${payload.taskId ?? ""}`;
      const assignedUserIds: string[] = Array.isArray(payload.assignedUserIds) ? payload.assignedUserIds : [];
      const projectAssignedUserIds: string[] = Array.isArray(payload.projectAssignedUserIds)
        ? payload.projectAssignedUserIds
        : [];
      const newlyAssignedUserIds: string[] = Array.isArray(payload.newlyAssignedUserIds)
        ? payload.newlyAssignedUserIds
        : [];

      if (payload.type === "task_created" && assignedUserIds.includes(user.id)) {
        push({
          title: "New Task Assigned",
          message: payload.taskTitle ? `${payload.taskTitle} is assigned to you.` : "A new task is assigned to you.",
          href: taskHref,
        });
        return;
      }

      if (
        payload.type === "task_created" &&
        ["ADMIN", "MANAGER", "SUPERADMIN"].includes(payload.actorRole) &&
        projectAssignedUserIds.includes(user.id)
      ) {
        push({
          title: "Project Task Added",
          message: payload.taskTitle
            ? `New task added in your project: ${payload.taskTitle}.`
            : "A new task was added in your project.",
          href: taskHref,
        });
        return;
      }

      if (payload.type === "task_modified") {
        if (newlyAssignedUserIds.includes(user.id)) {
          push({
            title: "Task Assigned",
            message: payload.taskTitle
              ? `You were added to ${payload.taskTitle}.`
              : "You were added to a task assignment.",
            href: taskHref,
          });
          return;
        }

        if (assignedUserIds.includes(user.id)) {
          push({
            title: "Task Updated",
            message: payload.taskTitle ? `${payload.taskTitle} was updated.` : "One of your tasks was updated.",
            href: taskHref,
          });
        }
        return;
      }

      if (payload.type === "task_progress_updated") {
        if (assignedUserIds.includes(user.id) && payload.actorRole && payload.actorRole !== user.role) {
          push({
            title: "Task Progress Updated",
            message: payload.taskTitle
              ? `${payload.taskTitle} progress/status changed.`
              : "A task progress update was posted.",
            href: taskHref,
          });
          return;
        }

        if (
          ["SUPERADMIN", "ADMIN", "MANAGER"].includes(user.role) &&
          payload.actorRole &&
          (payload.actorRole === "EMPLOYEE" || payload.actorRole === "INTERN")
        ) {
          push({
            title: "Team Task Update",
            message: payload.taskTitle
              ? `Progress updated on ${payload.taskTitle}.`
              : "An employee/intern updated task progress.",
            href: taskHref,
          });
        }
      }
    };

    const handleIssueUpdated = (payload: any = {}) => {
      if (payload.actorId === user.id) {
        return;
      }

      const issueHref = `/tasks?taskId=${payload.taskId ?? ""}&issueId=${payload.issueId ?? ""}`;
      const roles: string[] = Array.isArray(payload.notifyRoles) ? payload.notifyRoles : [];
      const assignedUserIds: string[] = Array.isArray(payload.assignedUserIds) ? payload.assignedUserIds : [];

      if (payload.type === "issue_reported") {
        if (!roles.includes(user.role)) {
          return;
        }
        push({
          title: "New Issue Reported",
          message: payload.reporterName
            ? `${payload.reporterName} reported: ${payload.issueTitle ?? "Task issue"}.`
            : "An employee/intern reported a new issue.",
          href: issueHref,
        });
        return;
      }

      if (payload.type === "issue_responded") {
        const shouldNotify = payload.reporterId === user.id || assignedUserIds.includes(user.id);
        if (!shouldNotify) {
          return;
        }

        push({
          title: "Issue Updated",
          message: payload.issueTitle
            ? `Response added for: ${payload.issueTitle}.`
            : "A response was added to your reported issue.",
          href: issueHref,
        });
      }
    };

    const handleLeaveEvent = (eventType: string, payload: any = {}) => {
      if (payload.actorId === user.id) {
        return;
      }

      const assignedUserIds: string[] = Array.isArray(payload.assignedUserIds) ? payload.assignedUserIds : [];
      const notifyRoles: string[] = Array.isArray(payload.notifyRoles) ? payload.notifyRoles : [];
      const shouldNotify = assignedUserIds.includes(user.id) || notifyRoles.includes(user.role);
      if (!shouldNotify) {
        return;
      }

      const leaveHref = `/leaves/${payload.leaveId ?? ""}`;
      if (eventType === "created") {
        push({
          title: "Leave Request Submitted",
          message: payload.leaveId ? "A new leave request is awaiting approval." : "A leave request was submitted.",
          href: leaveHref,
        });
        return;
      }

      if (eventType === "updated") {
        push({
          title: "Leave Request Updated",
          message: payload.leaveId ? "A leave request was updated." : "A leave request has been updated.",
          href: leaveHref,
        });
        return;
      }

      if (eventType === "status") {
        push({
          title: "Leave Status Changed",
          message: payload.leaveId ? "A leave request status has changed." : "A leave request status changed.",
          href: leaveHref,
        });
        return;
      }

      if (eventType === "comment") {
        push({
          title: "Leave Comment Added",
          message: payload.leaveId ? "A new comment was posted on a leave request." : "A leave request received a comment.",
          href: leaveHref,
        });
      }
    };

    const handleLeaveCreated = (payload: any) => handleLeaveEvent("created", payload);
    const handleLeaveUpdated = (payload: any) => handleLeaveEvent("updated", payload);
    const handleLeaveStatus = (payload: any) => handleLeaveEvent("status", payload);
    const handleLeaveComment = (payload: any) => handleLeaveEvent("comment", payload);

    socket.on("task:updated", handleTaskUpdated);
    socket.on("issue:updated", handleIssueUpdated);
    socket.on("leave:created", handleLeaveCreated);
    socket.on("leave:updated", handleLeaveUpdated);
    socket.on("leave:status", handleLeaveStatus);
    socket.on("leave:comment", handleLeaveComment);

    return () => {
      socket.off("task:updated", handleTaskUpdated);
      socket.off("issue:updated", handleIssueUpdated);
      socket.off("leave:created", handleLeaveCreated);
      socket.off("leave:updated", handleLeaveUpdated);
      socket.off("leave:status", handleLeaveStatus);
      socket.off("leave:comment", handleLeaveComment);
    };
  }, [socket, user.id, user.role]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const markAllRead = () => {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
  };

  const markRead = (id: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  const clearAll = () => {
    setItems([]);
  };

  return {
    items,
    unreadCount,
    lastPushedId,
    markAllRead,
    markRead,
    clearAll,
  };
}
