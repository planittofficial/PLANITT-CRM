import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { getAllowedCorsOrigins, getJwtSecret, isCorsOriginAllowed } from "./config/security.js";
import { getAuthCookieName } from "./utils/auth-cookie.js";

let ioInstance = null;
const LEADERSHIP_ROLES = ["SUPERADMIN", "ADMIN", "MANAGER"];

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
    if (user?.userId) {
      socket.join(`user:${user.userId}`);
    }
    if (user?.role) {
      socket.join(`role:${user.role}`);
    }

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
