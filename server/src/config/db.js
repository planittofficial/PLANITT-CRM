import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

if (!("prismaBase" in globalForPrisma)) {
  globalForPrisma.prismaBase = undefined;
}
const MAX_TRANSIENT_RETRIES = 2;
let reconnectPromise = null;

function isTransientConnectionError(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const message = typeof error?.message === "string" ? error.message : "";

  return (
    code === "P1001" ||
    code === "P1017" ||
    message.includes("Engine is not yet connected") ||
    message.includes("ConnectionReset") ||
    message.includes("forcibly closed by the remote host") ||
    message.includes("server closed the connection")
  );
}

const baseClient =
  globalForPrisma.prismaBase ??
  new PrismaClient({
    log: ["warn", "error"],
  });

async function reconnectClient() {
  if (!reconnectPromise) {
    reconnectPromise = (async () => {
      await baseClient.$disconnect().catch(() => {});
      await baseClient.$connect();
    })().finally(() => {
      reconnectPromise = null;
    });
  }

  return reconnectPromise;
}

export const prisma = baseClient.$extends({
  query: {
    async $allOperations({ args, query }) {
      for (let attempt = 0; attempt <= MAX_TRANSIENT_RETRIES; attempt += 1) {
        try {
          return await query(args);
        } catch (error) {
          if (!isTransientConnectionError(error) || attempt >= MAX_TRANSIENT_RETRIES) {
            throw error;
          }

          await reconnectClient();
          await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
        }
      }

      return query(args);
    },
  },
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = baseClient;
}

export default prisma;