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
import { registerDeviceToken, unregisterDeviceToken, sendPushNotificationToUsers } from "../services/fcm.service.js";

const router = express.Router();

// All notification routes require authentication
router.use(authMiddleware);

// FCM Mobile Push Registration
router.post("/fcm/register", async (req, res) => {
  try {
    const { token, platform, deviceModel } = req.body;
    if (!token) return res.status(400).json({ error: "Device token is required" });
    const record = await registerDeviceToken(req.user.userId, { token, platform, deviceModel });
    res.json({ success: true, record });
  } catch (err) {
    res.status(500).json({ error: "Failed to register FCM token" });
  }
});

router.post("/fcm/unregister", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token is required" });
    await unregisterDeviceToken(token);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to unregister FCM token" });
  }
});

router.post("/fcm/test", async (req, res) => {
  try {
    const { title = "Planitt CRM Test Push", body = "FCM push notification working!", data } = req.body;
    const result = await sendPushNotificationToUsers([req.user.userId], { title, body, data });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: "Failed to send test push notification" });
  }
});

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
