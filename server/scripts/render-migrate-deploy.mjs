import { execSync } from "node:child_process";

const PRISMA_CLI = "node ./node_modules/prisma/build/index.js";
const SCHEMA = "./server/prisma/schema.prisma";
const FAILED_CREDENTIALS_MIGRATION = "20260623154500_add_credentials_tracking";

function run(command, { inherit = true } = {}) {
  execSync(command, {
    stdio: inherit ? "inherit" : "pipe",
    encoding: "utf8",
  });
}

function runCapture(command) {
  try {
    return execSync(command, { stdio: "pipe", encoding: "utf8" });
  } catch (error) {
    const stdout = typeof error.stdout === "string" ? error.stdout : "";
    const stderr = typeof error.stderr === "string" ? error.stderr : "";
    const wrapped = new Error(`${stdout}\n${stderr}\n${error.message ?? ""}`.trim());
    wrapped.stdout = stdout;
    wrapped.stderr = stderr;
    throw wrapped;
  }
}

function deployMigrations() {
  return runCapture(`${PRISMA_CLI} migrate deploy --schema ${SCHEMA}`);
}

function resolveFailedCredentialsMigration() {
  console.warn(
    `[migrate] Recovering failed migration ${FAILED_CREDENTIALS_MIGRATION} (tables likely already exist from a prior db push).`
  );
  run(`${PRISMA_CLI} migrate resolve --applied ${FAILED_CREDENTIALS_MIGRATION} --schema ${SCHEMA}`);
}

try {
  const output = deployMigrations();
  if (output) process.stdout.write(output);
} catch (error) {
  const combined = `${error.stdout ?? ""}\n${error.stderr ?? ""}\n${error.message ?? ""}`;
  if (combined.includes("P3009") && combined.includes(FAILED_CREDENTIALS_MIGRATION)) {
    resolveFailedCredentialsMigration();
    deployMigrations();
  } else {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
}

run(`${PRISMA_CLI} generate --schema ${SCHEMA}`);
