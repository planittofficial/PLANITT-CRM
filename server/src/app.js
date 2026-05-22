import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import apiRouter from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { getAllowedCorsOrigins, isCorsOriginAllowed } from "./config/security.js";
import { commandBlacklistMiddleware } from "./middleware/command-blacklist.middleware.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Render / Vercel / other reverse proxies set X-Forwarded-*; required for express-rate-limit and accurate req.ip */
app.set("trust proxy", 1);

const allowedOrigins = getAllowedCorsOrigins();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later." },
});

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }
      const corsError = new Error("CORS origin not allowed");
      corsError.status = 403;
      callback(corsError);
    },
    credentials: true,
  })
);
/** Session checks hit this route very often; do not count them toward login brute-force limits. */
app.use((req, res, next) => {
  if (req.path === "/api/auth/me") {
    return next();
  }
  if (req.path.startsWith("/api/auth")) {
    return authLimiter(req, res, next);
  }
  return next();
});
app.use(express.json());
app.use(cookieParser());
app.use(commandBlacklistMiddleware);
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));
app.use("/api", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
