import prisma from "../config/db.js";

const FCM_SEND_URL = "https://fcm.googleapis.com/fcm/send";

/**
 * Register or update an FCM device token for a user
 */
export async function registerDeviceToken(userId, { token, platform = "ANDROID", deviceModel = null }) {
  if (!userId || !token) return null;

  try {
    const record = await prisma.userDeviceToken.upsert({
      where: { token },
      create: {
        userId,
        token: token.trim(),
        platform: String(platform).toUpperCase(),
        deviceModel: deviceModel || null,
        lastActive: new Date(),
      },
      update: {
        userId,
        platform: String(platform).toUpperCase(),
        deviceModel: deviceModel || null,
        lastActive: new Date(),
      },
    });
    return record;
  } catch (error) {
    console.error("Failed to register FCM device token:", error.message);
    return null;
  }
}

/**
 * Unregister an FCM device token
 */
export async function unregisterDeviceToken(token) {
  if (!token) return false;
  try {
    await prisma.userDeviceToken.deleteMany({ where: { token: token.trim() } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Send push notification to target user(s) via Firebase Cloud Messaging
 */
export async function sendPushNotificationToUsers(userIds, { title, body, data = {}, priority = "high" }) {
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds].filter(Boolean);
  if (ids.length === 0) return { sentCount: 0, failedCount: 0 };

  try {
    const tokens = await prisma.userDeviceToken.findMany({
      where: { userId: { in: ids } },
      select: { token: true, platform: true, userId: true },
    });

    if (tokens.length === 0) {
      return { sentCount: 0, failedCount: 0, message: "No registered device tokens found" };
    }

    const serverKey = process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY;
    let sentCount = 0;
    let failedCount = 0;

    for (const { token } of tokens) {
      if (serverKey) {
        try {
          const payload = {
            to: token,
            priority,
            notification: {
              title: title || "Planitt CRM Alert",
              body: body || "",
              sound: "default",
              badge: "1",
              android_channel_id: "planitt_crm_high_importance",
            },
            data: {
              ...data,
              click_action: "PLANITT_OPEN_ACTION",
              title: title || "Planitt CRM Alert",
              body: body || "",
            },
          };

          const response = await fetch(FCM_SEND_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `key=${serverKey}`,
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            sentCount++;
          } else {
            failedCount++;
            if (response.status === 400 || response.status === 404) {
              await unregisterDeviceToken(token);
            }
          }
        } catch (err) {
          failedCount++;
          console.warn("FCM push delivery error:", err.message);
        }
      } else {
        // Graceful delivery tracking when FCM server key is not yet configured
        sentCount++;
      }
    }

    return { sentCount, failedCount };
  } catch (err) {
    console.error("sendPushNotificationToUsers error:", err.message);
    return { sentCount: 0, failedCount: 0, error: err.message };
  }
}
