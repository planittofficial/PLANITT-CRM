import jwt from "jsonwebtoken";
import { getJwtSecret } from "../config/security.js";
import { getAuthCookieName } from "../utils/auth-cookie.js";
import { writeActivityLog } from "../services/activity-log.service.js";

function resolveToken(req) {
  const bearerToken = req.headers.authorization?.split(" ")[1];
  if (bearerToken) {
    return bearerToken;
  }

  const cookieToken = req.cookies?.[getAuthCookieName()];
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

export function authMiddleware(req, res, next) {
  const hasBearerToken = Boolean(req.headers.authorization?.split(" ")[1]);
  const hasCookieToken = Boolean(req.cookies?.[getAuthCookieName()]);

  try {
    const token = resolveToken(req);

    if (!token) {
      // #region agent log
      fetch("http://127.0.0.1:7655/ingest/6ce29a90-8aa2-4d64-ba64-939786193f6a",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"1645cd"},body:JSON.stringify({sessionId:"1645cd",runId:"auth-debug",hypothesisId:"H2-cookie-session-flow",location:"server/src/middleware/auth.middleware.js:25",message:"Auth middleware rejected request due to missing token",data:{path:req.path,origin:req.headers.origin ?? null,host:req.headers.host ?? null,hasBearerToken,hasCookieToken,cookieHeaderPresent:Boolean(req.headers.cookie)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return res.status(401).json({ error: "Unauthorized" });
    }

    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret);

    req.user = {
      ...decoded,
      authProvider: decoded.authProvider ?? "password",
    };

    const role = req.user?.role;
    const method = String(req.method || "").toUpperCase();
    const shouldLogAllRoles = String(process.env.ACTIVITY_LOG_ALL_ROLES || "false").toLowerCase() === "true";
    const shouldLogByRole = role === "INTERN" || shouldLogAllRoles;
    const shouldLogByMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

    if (shouldLogByRole || shouldLogByMethod) {
      res.on("finish", () => {
        void writeActivityLog({
          userId: req.user?.userId,
          userRole: req.user?.role,
          method,
          path: req.originalUrl || req.path,
          statusCode: res.statusCode,
          ipAddress: req.ip || null,
          userAgent: req.headers["user-agent"] || null,
          requestId: req.headers["x-request-id"] || null,
          metadata: {
            hasBody: Boolean(req.body && Object.keys(req.body).length),
            queryKeys: Object.keys(req.query || {}),
          },
        });
      });
    }

    return next();
  } catch (_err) {
    // #region agent log
    fetch("http://127.0.0.1:7655/ingest/6ce29a90-8aa2-4d64-ba64-939786193f6a",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"1645cd"},body:JSON.stringify({sessionId:"1645cd",runId:"auth-debug",hypothesisId:"H2-cookie-session-flow",location:"server/src/middleware/auth.middleware.js:37",message:"Auth middleware rejected request due to invalid token",data:{path:req.path,origin:req.headers.origin ?? null,host:req.headers.host ?? null,hasBearerToken,hasCookieToken},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return res.status(401).json({ error: "Invalid token" });
  }
}

export const protect = authMiddleware;

export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
}
