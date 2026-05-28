import "dotenv/config";
import http from "http";
import app from "./src/app.js";
import { initSocket } from "./src/socket.js";
import prisma from "./src/config/db.js";
import { getJwtSecret } from "./src/config/security.js";

const port = process.env.PORT || 5000;

const server = http.createServer(app);
initSocket(server);

server.on("error", (error) => {
  if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Stop the existing server process and restart.`);
    process.exit(1);
  }

  console.error("Server startup error:", error);
  process.exit(1);
});

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectDatabaseWithRetry(maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await prisma.$connect();
      console.log("Database connection established.");
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown database error";
      console.error(`Database connection attempt ${attempt}/${maxAttempts} failed: ${message}`);
      if (attempt < maxAttempts) {
        await wait(1500 * attempt);
      }
    }
  }

  throw new Error("Unable to connect to database after multiple attempts.");
}

async function start() {
  getJwtSecret();
  try {
    await connectDatabaseWithRetry();
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      throw err;
    }
    console.error(
      "Unable to connect to database after multiple attempts. Starting server in degraded mode; some API routes may fail."
    );
  }

  server.listen(port, () => {
    console.log(`CRM API running on http://localhost:${port}`);
  });
}

void start();
