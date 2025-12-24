type Bucket = {
    tokens: number;
    lastRefill: number;
};

const buckets = new Map<string, Bucket>();

// TTL: 10分間アクセスがないエントリを削除
const TTL_MS = 10 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1分ごとにクリーンアップ

// スイーパー（古いエントリを定期削除）
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, bucket] of buckets.entries()) {
            if (now - bucket.lastRefill > TTL_MS) {
                buckets.delete(key);
            }
        }
    }, CLEANUP_INTERVAL_MS);
}

/**
 * Simple token bucket rate limiter (in-memory).
 * NOTE: This is best-effort and not suitable for multi-instance deployments.
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const bucket = buckets.get(key) ?? { tokens: limit, lastRefill: now };

    // Refill tokens proportionally to elapsed time
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
        const refillTokens = Math.floor((elapsed / windowMs) * limit);
        if (refillTokens > 0) {
            bucket.tokens = Math.min(limit, bucket.tokens + refillTokens);
            bucket.lastRefill = now;
        }
    }

    if (bucket.tokens > 0) {
        bucket.tokens -= 1;
        buckets.set(key, bucket);
        return { allowed: true, remaining: bucket.tokens };
    }

    // not allowed
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0 };
}
