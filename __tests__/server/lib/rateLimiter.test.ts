import { checkRateLimit } from "../../../server/lib/rateLimiter";

describe("rateLimiter", () => {
    it("allows first request", () => {
        const result = checkRateLimit("test:first:1", 10);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9);
    });

    it("tracks request count correctly", () => {
        const key = "test:count:" + Date.now();
        checkRateLimit(key, 5);
        checkRateLimit(key, 5);
        const result = checkRateLimit(key, 5);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
    });

    it("blocks after limit exceeded", () => {
        const key = "test:block:" + Date.now();
        for (let i = 0; i < 3; i++) {
            checkRateLimit(key, 3);
        }
        const result = checkRateLimit(key, 3);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it("uses separate keys independently", () => {
        const ts = Date.now();
        const key1 = "test:sep1:" + ts;
        const key2 = "test:sep2:" + ts;

        // Exhaust key1
        for (let i = 0; i < 3; i++) checkRateLimit(key1, 2);

        // key2 should still be allowed
        const result = checkRateLimit(key2, 2);
        expect(result.allowed).toBe(true);
    });

    it("respects custom window", () => {
        const key = "test:window:" + Date.now();
        // Use a very short window
        const result1 = checkRateLimit(key, 1, 10); // 10ms window
        expect(result1.allowed).toBe(true);

        const result2 = checkRateLimit(key, 1, 10);
        expect(result2.allowed).toBe(false);
    });
});
