import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../services/notification.service.js";
import { sendSafeError } from "../middleware/error.middleware.js";

/**
 * GET /api/notifications
 * Fetch notifications for the authenticated user
 */
export async function getNotifications(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 40, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const unreadOnly = req.query.unreadOnly === "true";

    const { notifications, total } = await getUserNotifications(userId, {
      limit,
      offset,
      unreadOnly,
    });

    return res.json({
      notifications,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error in getNotifications:", error);
    return sendSafeError(res, 500, "Failed to fetch notifications");
  }
}

/**
 * GET /api/notifications/unread-count
 * Get unread notification count for the authenticated user
 */
export async function getUnreadCount(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const count = await getUnreadNotificationCount(userId);

    return res.json({ unreadCount: count });
  } catch (error) {
    console.error("Error in getUnreadCount:", error);
    return sendSafeError(res, 500, "Failed to get unread count");
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
export async function markAsRead(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Notification ID is required" });
    }

    const notification = await markNotificationAsRead(id, userId);

    return res.json(notification);
  } catch (error) {
    if (error.message === "Unauthorized") {
      return res.status(403).json({ error: "Forbidden" });
    }
    console.error("Error in markAsRead:", error);
    return sendSafeError(res, 500, "Failed to mark notification as read");
  }
}

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the authenticated user
 */
export async function markAllAsRead(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await markAllNotificationsAsRead(userId);

    return res.json(result);
  } catch (error) {
    console.error("Error in markAllAsRead:", error);
    return sendSafeError(res, 500, "Failed to mark all notifications as read");
  }
}

/**
 * DELETE /api/notifications/:id
 * Delete a single notification
 */
export async function deleteNotificationById(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Notification ID is required" });
    }

    await deleteNotification(id, userId);

    return res.json({ success: true });
  } catch (error) {
    if (error.message === "Unauthorized") {
      return res.status(403).json({ error: "Forbidden" });
    }
    console.error("Error in deleteNotificationById:", error);
    return sendSafeError(res, 500, "Failed to delete notification");
  }
}

/**
 * DELETE /api/notifications
 * Clear all notifications for the authenticated user
 */
export async function clearNotifications(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await clearAllNotifications(userId);

    return res.json(result);
  } catch (error) {
    console.error("Error in clearNotifications:", error);
    return sendSafeError(res, 500, "Failed to clear notifications");
  }
}

/**
 * GET /api/notifications/preferences
 * Get notification preferences for the authenticated user
 */
export async function getPreferences(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const preferences = await getNotificationPreferences(userId);

    return res.json(preferences);
  } catch (error) {
    console.error("Error in getPreferences:", error);
    return sendSafeError(res, 500, "Failed to get notification preferences");
  }
}

/**
 * PATCH /api/notifications/preferences
 * Update notification preferences for the authenticated user
 */
export async function updatePreferences(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const updates = req.body;
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updates provided" });
    }

    // Whitelist allowed fields
    const allowedFields = [
      "tasksAssigned",
      "tasksUpdated",
      "taskProgress",
      "taskOverdue",
      "taskMentions",
      "issueReported",
      "issueResponse",
      "projectUpdates",
      "attendanceAlerts",
      "chatMentions",
      "leaveRequests",
      "credentialAlerts",
    ];

    const sanitizedUpdates = {};
    for (const field of allowedFields) {
      if (field in updates) {
        sanitizedUpdates[field] = Boolean(updates[field]);
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const preferences = await updateNotificationPreferences(userId, sanitizedUpdates);

    return res.json(preferences);
  } catch (error) {
    console.error("Error in updatePreferences:", error);
    return sendSafeError(res, 500, "Failed to update notification preferences");
  }
}
