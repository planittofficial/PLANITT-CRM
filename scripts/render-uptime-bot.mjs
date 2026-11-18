#!/usr/bin/env node

/**
 * ============================================================================
 * Planitt CRM - Render Backend Uptime & Keep-Alive Bot
 * ============================================================================
 *
 * Keeps Render free-tier web services awake by sending periodic health check
 * requests. Render services sleep after 15 minutes of HTTP inactivity; this bot
 * prevents cold starts (which otherwise take 40-60s) so users experience instant
 * logins.
 *
 * Usage:
 *   node scripts/render-uptime-bot.mjs
 *   node scripts/render-uptime-bot.mjs --interval=30
 *   node scripts/render-uptime-bot.mjs --once
 *   node scripts/render-uptime-bot.mjs https://planitt-crm-ewr4.onrender.com
 *
 * Environment variables:
 *   RENDER_BACKEND_URL or NEXT_PUBLIC_API_URL or API_URL
 *   PING_INTERVAL_MINUTES (default: 14 to stay ahead of Render's 15m idle sleep)
 *   ALERT_WEBHOOK_URL (optional: Discord / Slack incoming webhook)
 * ============================================================================
 */

import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// 1. Configuration & CLI Argument Parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const isOnce = args.includes("--once");

// Parse --interval=N or default
let intervalMinutes = 14; // Render free tier sleeps after 15 min; 14 min keeps it 100% warm
const intervalArg = args.find((a) => a.startsWith("--interval="));
if (intervalArg) {
  const parsed = parseInt(intervalArg.split("=")[1], 10);
  if (!isNaN(parsed) && parsed > 0) {
    intervalMinutes = parsed;
  }
} else if (process.env.PING_INTERVAL_MINUTES) {
  const parsed = parseInt(process.env.PING_INTERVAL_MINUTES, 10);
  if (!isNaN(parsed) && parsed > 0) {
    intervalMinutes = parsed;
  }
}

// ---------------------------------------------------------------------------
// 2. Discover Target URL
// ---------------------------------------------------------------------------
function getTargetUrlFromEnvFiles() {
  const candidates = [
    path.join(ROOT_DIR, "client", ".env.local"),
    path.join(ROOT_DIR, "client", ".env"),
    path.join(ROOT_DIR, "server", ".env"),
    path.join(ROOT_DIR, ".env"),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
          const [key, ...rest] = trimmed.split("=");
          const val = rest.join("=").trim().replace(/^["']|["']$/g, "");
          if (
            (key === "NEXT_PUBLIC_API_URL" ||
              key === "RENDER_BACKEND_URL" ||
              key === "API_URL") &&
            val.startsWith("http")
          ) {
            return val;
          }
        }
      } catch {
        // ignore file read error
      }
    }
  }
  return null;
}

// Check CLI URL argument
let targetRaw =
  args.find((a) => a.startsWith("http://") || a.startsWith("https://")) ||
  process.env.RENDER_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  getTargetUrlFromEnvFiles() ||
  "https://planitt-crm-ewr4.onrender.com/api";

// Normalize target URL to health check endpoint
function resolveHealthEndpoint(raw) {
  try {
    const url = new URL(raw);
    let pathname = url.pathname.replace(/\/+$/, "");

    if (pathname.endsWith("/health")) {
      return url.toString();
    }
    if (pathname.endsWith("/api")) {
      url.pathname = `${pathname}/health`;
      return url.toString();
    }
    if (pathname === "" || pathname === "/") {
      url.pathname = "/api/health";
      return url.toString();
    }
    url.pathname = `${pathname}/health`;
    return url.toString();
  } catch {
    return `${raw.replace(/\/+$/, "")}/health`;
  }
}

const TARGET_HEALTH_URL = resolveHealthEndpoint(targetRaw);
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || null;

// ---------------------------------------------------------------------------
// 3. Stats & Metrics
// ---------------------------------------------------------------------------
const stats = {
  startedAt: new Date(),
  totalPings: 0,
  successfulPings: 0,
  failedPings: 0,
  consecutiveFailures: 0,
  lastPingTime: null,
  lastLatencyMs: null,
  lastStatusCode: null,
};

// ---------------------------------------------------------------------------
// 4. HTTP Ping Execution with Timeout & Cold-Start Tolerance
// ---------------------------------------------------------------------------
function pingUrl(targetUrl, timeoutMs = 75000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const options = {
      method: "GET",
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        "User-Agent": "PlanittCRM-UptimeBot/1.0 (+https://github.com/planittofficial/PLANITT-CRM)",
        Accept: "application/json, text/plain, */*",
        "Cache-Control": "no-cache",
      },
      timeout: timeoutMs,
    };

    const startTime = Date.now();
    const req = client.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        const latencyMs = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode ?? 0,
          latencyMs,
          headers: res.headers,
          body: body.slice(0, 300),
        });
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Connection timed out after ${timeoutMs / 1000}s (Server may be cold booting)`));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}

// ---------------------------------------------------------------------------
// 5. Discord / Slack Webhook Alert
// ---------------------------------------------------------------------------
async function sendWebhookAlert(message) {
  if (!ALERT_WEBHOOK_URL) return;
  try {
    const payload = JSON.stringify({ content: `🚨 [Planitt CRM Uptime Alert] ${message}` });
    const parsed = new URL(ALERT_WEBHOOK_URL);
    const client = parsed.protocol === "https:" ? https : http;

    const req = client.request(
      ALERT_WEBHOOK_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      () => {}
    );
    req.on("error", () => {});
    req.write(payload);
    req.end();
  } catch {
    // Ignore alert delivery failure
  }
}

// ---------------------------------------------------------------------------
// 6. Perform Keep-Alive Ping Cycle with Auto-Retries
// ---------------------------------------------------------------------------
async function executePingCycle(isRetry = false) {
  stats.totalPings++;
  const timestamp = new Date().toLocaleTimeString();

  try {
    const result = await pingUrl(TARGET_HEALTH_URL);
    stats.lastPingTime = new Date();
    stats.lastLatencyMs = result.latencyMs;
    stats.lastStatusCode = result.statusCode;

    // Render return states
    const renderRouting = result.headers["x-render-routing"];

    if (result.statusCode >= 200 && result.statusCode < 400) {
      stats.successfulPings++;
      stats.consecutiveFailures = 0;
      console.log(
        `[${timestamp}] \x1b[32m✔ OK\x1b[0m [${result.statusCode}] - ` +
          `Backend alive in \x1b[36m${result.latencyMs}ms\x1b[0m ` +
          `(Success: ${stats.successfulPings}/${stats.totalPings})`
      );
      return true;
    }

    // Handle Render-specific status headers
    if (renderRouting === "no-server") {
      stats.failedPings++;
      stats.consecutiveFailures++;
      console.warn(
        `[${timestamp}] \x1b[33m⚠ Render Warning\x1b[0m: Render reported 'no-server' (HTTP ${result.statusCode}).\n` +
          `  -> Please verify the service name or URL in the Render Dashboard.`
      );
      return false;
    }

    if (renderRouting === "suspend-by-user") {
      stats.failedPings++;
      stats.consecutiveFailures++;
      console.warn(
        `[${timestamp}] \x1b[31m✖ Render Suspended\x1b[0m: This Render service is marked as SUSPENDED by user.\n` +
          `  -> Resume the service in the Render Dashboard.`
      );
      return false;
    }

    // 502/503 may happen temporarily during Render cold boot
    if ((result.statusCode === 502 || result.statusCode === 503) && !isRetry) {
      console.log(
        `[${timestamp}] \x1b[33m⏳ Cold Booting\x1b[0m [${result.statusCode}]: Render is spinning up. Retrying in 10s...`
      );
      await new Promise((r) => setTimeout(r, 10000));
      return await executePingCycle(true);
    }

    stats.failedPings++;
    stats.consecutiveFailures++;
    console.error(
      `[${timestamp}] \x1b[31m✖ HTTP Error\x1b[0m [${result.statusCode}] in ${result.latencyMs}ms. Body: ${result.body}`
    );
    return false;
  } catch (error) {
    stats.failedPings++;
    stats.consecutiveFailures++;
    const errMsg = error instanceof Error ? error.message : String(error);

    if (!isRetry && (errMsg.includes("timed out") || errMsg.includes("ECONNRESET"))) {
      console.log(
        `[${timestamp}] \x1b[33m⏳ Waking up\x1b[0m (${errMsg}). Retrying in 12s...`
      );
      await new Promise((r) => setTimeout(r, 12000));
      return await executePingCycle(true);
    }

    console.error(`[${timestamp}] \x1b[31m✖ Network Failure\x1b[0m: ${errMsg}`);

    if (stats.consecutiveFailures >= 3) {
      await sendWebhookAlert(
        `Backend at ${TARGET_HEALTH_URL} has failed ${stats.consecutiveFailures} consecutive health checks. Error: ${errMsg}`
      );
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// 7. Banner & Initialization
// ---------------------------------------------------------------------------
function printBanner() {
  console.log(`\x1b[1m\x1b[35m============================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m   ⚡ Planitt CRM - Render Uptime & Keep-Alive Bot\x1b[0m`);
  console.log(`\x1b[1m\x1b[35m============================================================\x1b[0m`);
  console.log(`\x1b[33mTarget Endpoint\x1b[0m : \x1b[4m${TARGET_HEALTH_URL}\x1b[0m`);
  console.log(`\x1b[33mPing Interval  \x1b[0m : \x1b[32mEvery ${intervalMinutes} minutes\x1b[0m`);
  console.log(`\x1b[33mRender Idle Win\x1b[0m : Render sleeps after 15m; ${intervalMinutes}m interval guarantees zero cold starts.`);
  console.log(`\x1b[33mMode           \x1b[0m : ${isOnce ? "Single Ping (--once)" : "Continuous Daemon"}`);
  console.log(`\x1b[35m------------------------------------------------------------\x1b[0m`);
}

// ---------------------------------------------------------------------------
// 8. Main Execution Loop
// ---------------------------------------------------------------------------
async function main() {
  printBanner();

  // Initial immediate ping
  console.log(`[${new Date().toLocaleTimeString()}] Sending initial keep-alive ping...`);
  const success = await executePingCycle();

  if (isOnce) {
    process.exit(success ? 0 : 1);
  }

  // Schedule recurring interval
  const intervalMs = intervalMinutes * 60 * 1000;
  setInterval(async () => {
    await executePingCycle();
  }, intervalMs);

  console.log(`\x1b[32m✔ Uptime bot is active.\x1b[0m Next ping in ${intervalMinutes} minutes. Press Ctrl+C to exit.\n`);
}

// Graceful exit
process.on("SIGINT", () => {
  console.log("\n\x1b[33mUptime bot stopped by user (SIGINT).\x1b[0m");
  console.log(
    `Summary: ${stats.successfulPings}/${stats.totalPings} successful pings. Uptime active for ${Math.round(
      (Date.now() - stats.startedAt.getTime()) / 1000 / 60
    )} minutes.`
  );
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n\x1b[33mUptime bot stopped (SIGTERM).\x1b[0m");
  process.exit(0);
});

void main();
