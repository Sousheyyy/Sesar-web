import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Standard Node.js client (local dev / non-Cloudflare)
function createStandardClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

// Dynamically detect environment and return the right client.
// In Cloudflare Workers: uses Hyperdrive via @prisma/adapter-pg (per-request).
// In Node.js (local dev): uses standard PrismaClient singleton.
function getClient(): PrismaClient {
  try {
    // Access the Cloudflare context directly via the global symbol that
    // @opennextjs/cloudflare sets during request handling (via AsyncLocalStorage).
    const cfCtx = (globalThis as any)[Symbol.for("__cloudflare-context__")];

    if (cfCtx?.env?.HYPERDRIVE) {
      // Cache on cfCtx (per-request via AsyncLocalStorage) NOT on env (shared
      // across all requests in the isolate). Caching on env causes stale
      // connections after password rotations or Hyperdrive config changes.
      if (!cfCtx.__prisma) {
        const { PrismaPg } = require("@prisma/adapter-pg");
        // Use the WASM PrismaClient — the standard one requires a platform-specific
        // binary query engine that doesn't exist on Workers. The /wasm version uses a
        // portable WebAssembly engine instead.
        const { PrismaClient: PrismaClientWasm } = require("@prisma/client/wasm");
        const adapter = new PrismaPg({ connectionString: cfCtx.env.HYPERDRIVE.connectionString });
        cfCtx.__prisma = new PrismaClientWasm({ adapter });
      }
      return cfCtx.__prisma;
    }
  } catch (e) {
    console.error("[Prisma] Cloudflare context error:", e);
  }

  // Node.js: use global singleton (local dev)
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createStandardClient();
  }
  return globalForPrisma.prisma;
}

// Always use Proxy — it auto-detects Cloudflare vs Node.js on each access.
// Zero changes needed in the 41 files that import `prisma`.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_, prop) {
    return (getClient() as any)[prop];
  },
});

export async function withRetry<T>(
  query: () => Promise<T>,
  maxRetries = 2,
  delay = 500
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await query();
    } catch (error: any) {
      if (i < maxRetries - 1) {
        console.warn(
          `Database retry ${i + 1}/${maxRetries} due to: ${error.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Query failed after retries");
}
