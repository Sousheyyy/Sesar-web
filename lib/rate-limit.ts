// In-memory rate limiting (no Redis required)
interface RequestLog {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const requestLogs = new Map<string, RequestLog>();

export async function rateLimit(
  identifier: string,
  limit = 10,
  windowMs = 3600000 // 1 hour
): Promise<RateLimitResult> {
  const now = Date.now();
  const log = requestLogs.get(identifier);

  // Reset if window expired
  if (!log || now > log.resetAt) {
    const newLog = { count: 1, resetAt: now + windowMs };
    requestLogs.set(identifier, newLog);

    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: newLog.resetAt
    };
  }

  // Increment count
  log.count++;

  return {
    success: log.count <= limit,
    limit,
    remaining: Math.max(0, limit - log.count),
    reset: log.resetAt
  };
}

// Cleanup old entries every hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, log] of requestLogs.entries()) {
      if (now > log.resetAt) {
        requestLogs.delete(key);
      }
    }
  }, 3600000);
}
