import { prisma } from "@/lib/prisma";

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * DB-based rate limiting using apiCallLog table.
 * Works in both Node.js and Cloudflare Workers (stateless, no in-memory Map).
 */
export async function rateLimit(
  identifier: string,
  limit = 10,
  windowMs = 3600000 // 1 hour
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowMs);

  const count = await prisma.apiCallLog.count({
    where: {
      userId: identifier,
      endpoint: "/api/songs/upload",
      createdAt: { gte: windowStart },
    },
  });

  return {
    success: count < limit,
    limit,
    remaining: Math.max(0, limit - count),
    reset: Date.now() + windowMs,
  };
}
