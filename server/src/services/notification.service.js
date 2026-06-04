import prisma from "../config/db.js";
import { emitNotification, emitNotificationRead, emitNotificationDeleted, emitUnreadCount } from "../socket.js";

const DEFAULT_NOTIFICATION_PREFERENCES = {
  tasksAssigned: true,
  tasksUpdated: true,
  taskProgress: true,
  taskOverdue: true,
  taskMentions: true,
  issueReported: true,
  issueResponse: true,
  projectUpdates: true,
  attendanceAlerts: true,
  chatMentions: true,
  leaveRequests: true,
};

const ROLE_NOTIFICATION_DEFAULTS = {
  SUPERADMIN: DEFAULT_NOTIFICATION_PREFERENCES,
  ADMIN: DEFAULT_NOTIFICATION_PREFERENCES,
  MANAGER: DEFAULT_NOTIFICATION_PREFERENCES,
  EMPLOYEE: {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    attendanceAlerts: false,
  },
  INTERN: {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    attendanceAlerts: false,
  },
};

function isMissingNotificationTableError(error) {
  if (!error || !(error.code === "P2021" || error.code === "P2022")) {
    return false;
  }

  const metaValue = String(error?.meta?.table || error?.meta?.column || error?.meta || error?.message || "");
  return /notification(preference)?/i.test(metaValue);
}

async function getUserRole(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role ?? "EMPLOYEE";
}

async function getDefaultPreferencesForUser(userId) {
  const role = await getUserRole(userId);
  return {
    role,
    ...(ROLE_NOTIFICATION_DEFAULTS[role] ?? DEFAULT_NOTIFICATION_PREFERENCES),
  };
}

/**
 * Create a notification for a user
 */
export async function createNotification(data) {
  const {
    userId,
    type,
    title,
    message,
    href,
    priority = "MEDIUM",
    taskId = null,
    projectId = null,
    issueId = null,
    actorId = null,
    groupKey = null,
  } = data;

  try {
    // Deduplication: if groupKey provided, try to find a recent similar notification
    if (groupKey) {
      const cutoff = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          groupKey,
          createdAt: { gte: cutoff },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        // Update the existing notification to refresh timestamp and message
        const updated = await prisma.notification.update({
          where: { id: existing.id },
          data: {
            message,
            title,
            priority,
            read: false,
          },
        });
        emitNotification(userId, updated);
        const count = await getUnreadNotificationCount(userId);
        emitUnreadCount(userId, count);
        return updated;
      }
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        href,
        priority,
        taskId,
        projectId,
        issueId,
        actorId,
        groupKey,
      },
    });

    // Emit realtime notification and updated unread count
    try {
      emitNotification(userId, notification);
      const count = await getUnreadNotificationCount(userId);
      emitUnreadCount(userId, count);
    } catch (e) {
      console.error("Error emitting notification events:", e);
    }

    return notification;
  } catch (error) {
    if (isMissingNotificationTableError(error)) {
      console.warn("Notification tables are not migrated yet; emitting transient notification via socket.");
      const transient = {
        id: `transient:${Date.now()}:${userId}`,
        type,
        title,
        message,
        href,
        priority,
        taskId,
        projectId,
        issueId,
        actorId,
        groupKey,
        read: false,
        createdAt: new Date().toISOString(),
      };
      try {
        emitNotification(userId, transient);
        // Emit a transient unread count so UI shows an indicator (non-persistent)
        emitUnreadCount(userId, 1);
      } catch (e) {
        console.error("Error emitting transient notification:", e);
      }
      return transient;
    }
    console.error("Error creating notification:", error);
    throw error;
  }
}

/**
 * Create bulk notifications for multiple users
 */
export async function createBulkNotifications(userIds, notificationData) {
  try {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    const notifications = await Promise.all(
      uniqueUserIds.map((userId) =>
        createNotification({
          ...notificationData,
          userId,
        })
      )
    );

    return notifications;
  } catch (error) {
    console.error("Error creating bulk notifications:", error);
    throw error;
  }
}

/**
 * Fetch notifications for a user with pagination
 */
export async function getUserNotifications(userId, options = {}) {
  const { limit = 40, offset = 0, unreadOnly = false } = options;

  try {
    const where = { userId };
    if (unreadOnly) {
      where.read = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.notification.count({ where }),
    ]);

    return { notifications, total };
  } catch (error) {
    if (isMissingNotificationTableError(error)) {
      console.warn("Notification tables are not migrated yet; returning empty notification list.");
      return { notifications: [], total: 0 };
    }
    console.error("Error fetching notifications:", error);
    throw error;
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(userId) {
  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });

    return count;
  } catch (error) {
    if (isMissingNotificationTableError(error)) {
      console.warn("Notification tables are not migrated yet; returning unread count 0.");
      return 0;
    }
    console.error("Error getting unread notification count:", error);
    throw error;
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notificationId, userId) {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new Error("Unauthorized");
    }

    const updated = notification.read
      ? notification
      : await prisma.notification.update({
          where: { id: notificationId },
          data: { read: true },
        });

    try {
      emitNotificationRead(userId, notification.id);
      const count = await getUnreadNotificationCount(userId);
      emitUnreadCount(userId, count);
    } catch (e) {
      console.error("Error emitting read events:", e);
    }

    return updated;
  } catch (error) {
    if (isMissingNotificationTableError(error)) {
      console.warn("Notification tables are not migrated yet; skipping mark-as-read.");
      return null;
    }
    console.error("Error marking notification as read:", error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId) {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: { read: true },
    });

    try {
      emitNotificationRead(userId, { all: true });
      emitUnreadCount(userId, 0);
    } catch (e) {
      console.error("Error emitting markAll read events:", e);
    }

    return result;
  } catch (error) {
    if (isMissingNotificationTableError(error)) {
      console.warn("Notification tables are not migrated yet; skipping mark-all-read.");
      return { count: 0 };
    }
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId, userId) {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    try {
      emitNotificationDeleted(userId, notificationId);
      const count = await getUnreadNotificationCount(userId);
      emitUnreadCount(userId, count);
    } catch (e) {
      console.error("Error emitting deleted events:", e);
    }

    return true;
  } catch (error) {
    if (isMissingNotificationTableError(error)) {
      console.warn("Notification tables are not migrated yet; skipping delete.");
      return false;
    }
    console.error("Error deleting notification:", error);
    throw error;
  }
}

/**
 * Clear all notifications for a user
 */
export async function clearAllNotifications(userId) {
  try {
    const result = await prisma.notification.deleteMany({
      where: { userId },
    });

    try {
      emitNotificationDeleted(userId, { all: true });
      emitUnreadCount(userId, 0);
    } catch (e) {
      console.error("Error emitting clear events:", e);
    }

    return result;
  } catch (error) {
    if (isMissingNotificationTableError(error)) {
      console.warn("Notification tables are not migrated yet; skipping clear-all.");
      return { count: 0 };
    }
    console.error("Error clearing all notifications:", error);
    throw error;
  }
}

export async function getNotificationRecipientsByRoles(roles, excludeUserIds = []) {
  const normalizedRoles = Array.from(new Set((roles || []).filter(Boolean)));
  if (!normalizedRoles.length) {
    return [];
  }

  const excluded = new Set((excludeUserIds || []).filter(Boolean));
  const users = await prisma.user.findMany({
    where: {
      role: { in: normalizedRoles },
      id: excluded.size ? { notIn: Array.from(excluded) } : undefined,
    },
    select: { id: true },
  });

  return users.map((user) => user.id);
}

/**
 * Get or create notification preferences for a user
 */
export async function getNotificationPreferences(userId) {
  try {
    const defaults = await getDefaultPreferencesForUser(userId);
    let preferences = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await prisma.notificationPreference.create({
        data: { userId, role: defaults.role, ...defaults },
      });
    } else if (!preferences.role) {
      preferences = await prisma.notificationPreference.update({
        where: { userId },
        data: { role: defaults.role },
      });
    }

    return preferences;
  } catch (error) {
    if (isMissingNotificationTableError(error)) {
      console.warn("Notification tables are not migrated yet; returning default preferences.");
      const defaults = await getDefaultPreferencesForUser(userId).catch(() => ({
        role: "EMPLOYEE",
        ...ROLE_NOTIFICATION_DEFAULTS.EMPLOYEE,
      }));
      return { userId, ...defaults };
    }
    console.error("Error getting notification preferences:", error);
    throw error;
  }
}

/**
 * Update notification preferences for a user
 */
export async function updateNotificationPreferences(userId, updates) {
  try {
    const defaults = await getDefaultPreferencesForUser(userId);
    let preferences = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      preferences = await prisma.notificationPreference.create({
        data: { userId, role: defaults.role, ...defaults },
      });
    }

    const updated = await prisma.notificationPreference.update({
      where: { userId },
      data: { ...updates, role: defaults.role },
    });

    return updated;
  } catch (error) {
    if (isMissingNotificationTableError(error)) {
      console.warn("Notification tables are not migrated yet; returning requested preferences locally.");
      const defaults = await getDefaultPreferencesForUser(userId).catch(() => ({
        role: "EMPLOYEE",
        ...ROLE_NOTIFICATION_DEFAULTS.EMPLOYEE,
      }));
      return { userId, ...defaults, ...updates };
    }
    console.error("Error updating notification preferences:", error);
    throw error;
  }
}

/**
 * Check if a notification type is enabled for a user
 */
export async function isNotificationTypeEnabled(userId, notificationType) {
  try {
    const preferences = await getNotificationPreferences(userId);

    const preferenceMap = {
      TASK_ASSIGNED: preferences.tasksAssigned,
      TASK_UPDATED: preferences.tasksUpdated,
      TASK_PROGRESS: preferences.taskProgress,
      TASK_OVERDUE: preferences.taskOverdue,
      TASK_MENTION: preferences.taskMentions,
      ISSUE_REPORTED: preferences.issueReported,
      ISSUE_RESPONDED: preferences.issueResponse,
      ISSUE_RESOLVED: preferences.issueResponse,
      PROJECT_CREATED: preferences.projectUpdates,
      PROJECT_UPDATED: preferences.projectUpdates,
      PROJECT_MILESTONE: preferences.projectUpdates,
      ATTENDANCE_ALERT: preferences.attendanceAlerts,
      CHAT_MENTION: preferences.chatMentions,
      LEAVE_REQUEST: preferences.leaveRequests,
      LEAVE_APPROVED: preferences.leaveRequests,
      LEAVE_REJECTED: preferences.leaveRequests,
    };

    return preferenceMap[notificationType] !== false;
  } catch (error) {
    console.error("Error checking notification type:", error);
    return true; // Default to enabled if error
  }
}
