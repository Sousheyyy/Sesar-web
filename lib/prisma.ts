import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

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
        console.warn(`Database retry ${i + 1}/${maxRetries} due to: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Query failed after retries");
}