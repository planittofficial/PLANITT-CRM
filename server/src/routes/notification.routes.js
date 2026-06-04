import express from "express";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotificationById,
  clearNotifications,
  getPreferences,
  updatePreferences,
} from "../controllers/notification.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

// All notification routes require authentication
router.use(authMiddleware);

// Notifications
router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/:id/read", markAsRead);
router.patch("/read-all", markAllAsRead);
router.delete("/:id", deleteNotificationById);
router.delete("/", clearNotifications);

// Preferences
router.get("/preferences", getPreferences);
router.patch("/preferences", updatePreferences);

export default router;
