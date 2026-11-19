import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import prisma from "./config/db.js";
import { getAllowedCorsOrigins, getJwtSecret, isCorsOriginAllowed } from "./config/security.js";
import { getAuthCookieName } from "./utils/auth-cookie.js";
import { sendPushNotificationToUsers, registerDeviceToken, unregisterDeviceToken } from "./services/fcm.service.js";

let ioInstance = null;
const LEADERSHIP_ROLES = ["SUPERADMIN", "ADMIN", "MANAGER"];

// In-memory real-time presence management
const activePresences = new Map(); // userId -> { status, customStatusMessage, inMeetingUntil, lastSeen }
const userSocketCounts = new Map(); // userId -> count
const disconnectTimers = new Map(); // userId -> timeout

export function getAllLivePresences() {
  const result = [];
  for (const [userId, data] of activePresences.entries()) {
    result.push({ userId, ...data });
  }
  return result;
}

export function getLivePresence(userId) {
  return activePresences.get(userId) || null;
}

export function setLivePresence(userId, data = {}) {
  if (!userId) return null;
  const current = activePresences.get(userId) || {
    status: "AVAILABLE",
    customStatusMessage: null,
    inMeetingUntil: null,
    lastSeen: new Date().toISOString(),
  };

  const updated = {
    ...current,
    ...data,
    userId,
    lastSeen: new Date().toISOString(),
  };

  activePresences.set(userId, updated);

  if (ioInstance) {
    ioInstance.emit("presence:update", updated);
  }

  return updated;
}

function getSocketUser(socket) {
  return socket.data?.user ?? null;
}

function getAuthToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.trim();
  }

  const authHeader = socket.handshake.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  const cookieHeader = socket.handshake.headers?.cookie;
  if (typeof cookieHeader === "string" && cookieHeader) {
    const cookieKey = `${getAuthCookieName()}=`;
    const tokenCookie = cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(cookieKey));

    if (tokenCookie) {
      return decodeURIComponent(tokenCookie.slice(cookieKey.length));
    }
  }

  return null;
}

export function initSocket(server) {
  const allowedOrigins = getAllowedCorsOrigins();

  ioInstance = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (isCorsOriginAllowed(origin, allowedOrigins)) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
  });

  ioInstance.use((socket, next) => {
    try {
      const token = getAuthToken(socket);
      if (!token) {
        return next(new Error("Unauthorized socket connection"));
      }
      const decoded = jwt.verify(token, getJwtSecret());
      socket.data.user = {
        userId: decoded.userId,
        role: decoded.role,
      };
      return next();
    } catch (_error) {
      return next(new Error("Invalid socket token"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const user = getSocketUser(socket);
    const userId = user?.userId;

    if (userId) {
      socket.join(`user:${userId}`);

      // Handle presence tracking for connected user
      if (disconnectTimers.has(userId)) {
        clearTimeout(disconnectTimers.get(userId));
        disconnectTimers.delete(userId);
      }

      const prevCount = userSocketCounts.get(userId) || 0;
      userSocketCounts.set(userId, prevCount + 1);

      const existingPresence = activePresences.get(userId);
      if (!existingPresence || existingPresence.status === "OFFLINE") {
        prisma.user
          .findUnique({
            where: { id: userId },
            select: { presenceStatus: true, customStatusMessage: true, inMeetingUntil: true },
          })
          .then((dbUser) => {
            const status =
              dbUser?.presenceStatus && dbUser.presenceStatus !== "OFFLINE"
                ? dbUser.presenceStatus
                : "AVAILABLE";
            setLivePresence(userId, {
              status,
              customStatusMessage: dbUser?.customStatusMessage || null,
              inMeetingUntil: dbUser?.inMeetingUntil || null,
            });
            socket.emit("presence:batch", getAllLivePresences());
          })
          .catch(() => {
            setLivePresence(userId, { status: "AVAILABLE" });
            socket.emit("presence:batch", getAllLivePresences());
          });
      } else {
        socket.emit("presence:batch", getAllLivePresences());
      }
    }

    if (user?.role) {
      socket.join(`role:${user.role}`);
    }

    // Rich Presence Real-time Listeners
    socket.on("presence:get_batch", () => {
      socket.emit("presence:batch", getAllLivePresences());
    });

    socket.on("presence:set", async (payload = {}) => {
      if (!userId) return;
      const { status, customStatusMessage } = payload;
      const updated = setLivePresence(userId, {
        ...(status ? { status } : {}),
        ...(customStatusMessage !== undefined ? { customStatusMessage } : {}),
      });

      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            ...(status ? { presenceStatus: status } : {}),
            ...(customStatusMessage !== undefined ? { customStatusMessage } : {}),
          },
        });
      } catch (err) {
        console.warn("Failed to persist user presence:", err.message);
      }
    });

    socket.on("presence:meeting_started", async (payload = {}) => {
      if (!userId) return;
      const meetingTitle = payload.title || payload.meetingTitle || "Google Meet";
      const until = payload.until || new Date(Date.now() + 45 * 60000).toISOString();
      setLivePresence(userId, {
        status: "IN_A_MEETING",
        customStatusMessage: `In a Meeting: ${meetingTitle}`,
        inMeetingUntil: until,
      });

      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            presenceStatus: "IN_A_MEETING",
            customStatusMessage: `In a Meeting: ${meetingTitle}`,
            inMeetingUntil: new Date(until),
          },
        });
      } catch (err) {
        console.warn("Failed to persist user meeting presence:", err.message);
      }
    });

    socket.on("presence:meeting_ended", async () => {
      if (!userId) return;
      setLivePresence(userId, {
        status: "AVAILABLE",
        customStatusMessage: null,
        inMeetingUntil: null,
      });

      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            presenceStatus: "AVAILABLE",
            customStatusMessage: null,
            inMeetingUntil: null,
          },
        });
      } catch (err) {
        console.warn("Failed to persist user meeting end presence:", err.message);
      }
    });

    socket.on("disconnect", () => {
      if (!userId) return;
      const count = (userSocketCounts.get(userId) || 1) - 1;
      if (count <= 0) {
        userSocketCounts.delete(userId);
        const timer = setTimeout(() => {
          disconnectTimers.delete(userId);
          const current = activePresences.get(userId);
          const offlinePresence = {
            userId,
            status: "OFFLINE",
            customStatusMessage: current?.customStatusMessage || null,
            lastSeen: new Date().toISOString(),
          };
          activePresences.set(userId, offlinePresence);
          if (ioInstance) {
            ioInstance.emit("presence:update", offlinePresence);
          }
        }, 5000);
        disconnectTimers.set(userId, timer);
      } else {
        userSocketCounts.set(userId, count);
      }
    });

    // FCM Device Token Registration Listeners
    socket.on("fcm:register", async (payload = {}) => {
      if (!userId || !payload.token) return;
      await registerDeviceToken(userId, {
        token: payload.token,
        platform: payload.platform || "ANDROID",
        deviceModel: payload.deviceModel || null,
      });
    });

    socket.on("fcm:unregister", async (payload = {}) => {
      if (!payload.token) return;
      await unregisterDeviceToken(payload.token);
    });

    socket.on("crm:join", (payload = {}) => {
      const authUser = getSocketUser(socket);
      if (!authUser) {
        return;
      }

      if (authUser.role && LEADERSHIP_ROLES.includes(authUser.role)) {
        if (payload.departmentId) {
          socket.join(`department:${payload.departmentId}`);
        }
        if (payload.projectId) {
          socket.join(`project:${payload.projectId}`);
        }
      }
    });
  });

  return ioInstance;
}

export function getIo() {
  return ioInstance;
}

export function emitCRMEvent(eventName, payload) {
  if (!ioInstance) {
    return;
  }

  const deliveredRooms = new Set();
  LEADERSHIP_ROLES.forEach((role) => {
    ioInstance.to(`role:${role}`).emit(eventName, payload);
    deliveredRooms.add(`role:${role}`);
  });

  if (Array.isArray(payload?.assignedUserIds)) {
    payload.assignedUserIds.forEach((userId) => {
      if (!userId) {
        return;
      }
      ioInstance.to(`user:${userId}`).emit(eventName, payload);
      deliveredRooms.add(`user:${userId}`);
    });
  }

  if (Array.isArray(payload?.projectAssignedUserIds)) {
    payload.projectAssignedUserIds.forEach((userId) => {
      if (!userId) {
        return;
      }
      ioInstance.to(`user:${userId}`).emit(eventName, payload);
      deliveredRooms.add(`user:${userId}`);
    });
  }

  if (payload?.projectId) {
    ioInstance.to(`project:${payload.projectId}`).emit(eventName, payload);
    deliveredRooms.add(`project:${payload.projectId}`);
  }

  if (payload?.departmentId) {
    ioInstance.to(`department:${payload.departmentId}`).emit(eventName, payload);
    deliveredRooms.add(`department:${payload.departmentId}`);
  }

  if (deliveredRooms.size === 0) {
    ioInstance.to("role:SUPERADMIN").emit(eventName, payload);
  }
}

/**
 * Emit a notification to specific users
 * @param {string|string[]} userIds - Single user ID or array of user IDs
 * @param {Object} notification - Notification object with id, type, title, message, href, priority, read, createdAt, taskId, projectId, actorId
 */
export function emitNotification(userIds, notification) {
  if (!ioInstance) {
    return;
  }

  const targetUserIds = Array.isArray(userIds) ? userIds : [userIds];

  targetUserIds.forEach((userId) => {
    if (userId) {
      ioInstance.to(`user:${userId}`).emit("notification:new", notification);
    }
  });

  // Automatically dispatch mobile push notification via FCM
  sendPushNotificationToUsers(targetUserIds, {
    title: notification.title || "Planitt CRM Alert",
    body: notification.message || "",
    data: {
      id: notification.id ? String(notification.id) : "",
      href: notification.href || "/dashboard",
      type: notification.type || "INFO",
    },
    priority:
      notification.priority === "URGENT" || notification.priority === "HIGH" ? "high" : "normal",
  }).catch((err) => console.warn("Failed to dispatch FCM push notification:", err.message));
}

/**
 * Broadcast a notification to a specific role
 * @param {string} role - User role
 * @param {Object} notification - Notification object
 */
export function emitNotificationToRole(role, notification) {
  if (!ioInstance) {
    return;
  }

  ioInstance.to(`role:${role}`).emit("notification:new", notification);
}

/**
 * Emit a notification to all users in a project
 * @param {string} projectId - Project ID
 * @param {Object} notification - Notification object
 */
export function emitNotificationToProject(projectId, notification) {
  if (!ioInstance) {
    return;
  }

  ioInstance.to(`project:${projectId}`).emit("notification:new", notification);
}

/**
 * Emit a notification to all users in a department
 * @param {string} departmentId - Department ID
 * @param {Object} notification - Notification object
 */
export function emitNotificationToDepartment(departmentId, notification) {
  if (!ioInstance) {
    return;
  }

  ioInstance.to(`department:${departmentId}`).emit("notification:new", notification);
}

export function emitNotificationRead(userIds, notificationIds) {
  if (!ioInstance) return;
  const targets = Array.isArray(userIds) ? userIds : [userIds];
  targets.forEach((userId) => {
    if (!userId) return;
    if (notificationIds && typeof notificationIds === "object" && notificationIds.all) {
      ioInstance.to(`user:${userId}`).emit("notification:read", { all: true, ids: [] });
      return;
    }
    ioInstance.to(`user:${userId}`).emit("notification:read", {
      ids: Array.isArray(notificationIds) ? notificationIds : [notificationIds],
    });
  });
}

export function emitNotificationDeleted(userIds, notificationIds) {
  if (!ioInstance) return;
  const targets = Array.isArray(userIds) ? userIds : [userIds];
  targets.forEach((userId) => {
    if (!userId) return;
    if (notificationIds && typeof notificationIds === "object" && notificationIds.all) {
      ioInstance.to(`user:${userId}`).emit("notification:deleted", { all: true, ids: [] });
      return;
    }
    ioInstance.to(`user:${userId}`).emit("notification:deleted", {
      ids: Array.isArray(notificationIds) ? notificationIds : [notificationIds],
    });
  });
}

export function emitUnreadCount(userId, count) {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${userId}`).emit("notification:unread-count", { unreadCount: count });
}
