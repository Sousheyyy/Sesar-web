import { LRUCache } from "lru-cache";

interface RateLimitEntry {
    count: number;
    firstRequest: number;
}

const cache = new LRUCache<string, RateLimitEntry>({
    max: 50_000,
    ttl: 60_000,
});

/**
 * In-memory rate limiter using LRU cache.
 * @param key - Unique identifier (e.g. "strict:192.168.1.1:createUser")
 * @param limit - Max requests per window
 * @param windowMs - Time window in milliseconds (default 60s)
 */
export function checkRateLimit(
    key: string,
    limit: number,
    windowMs: number = 60_000
): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    const entry = cache.get(key);

    if (!entry) {
        cache.set(key, { count: 1, firstRequest: now }, { ttl: windowMs });
        return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
    }

    if (now - entry.firstRequest > windowMs) {
        cache.set(key, { count: 1, firstRequest: now }, { ttl: windowMs });
        return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
    }

    entry.count++;
    cache.set(key, entry);

    if (entry.count > limit) {
        const retryAfterMs = windowMs - (now - entry.firstRequest);
        return { allowed: false, remaining: 0, retryAfterMs };
    }

    return { allowed: true, remaining: limit - entry.count, retryAfterMs: 0 };
}
