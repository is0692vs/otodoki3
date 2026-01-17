type Bucket = {
    tokens: number;
    lastRefill: number;
};

// テスト用に export するが、通常利用はしない
export const _test_buckets = new Map<string, Bucket>();

// TTL: 10分間アクセスがないエントリを削除
const TTL_MS = 10 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000; // 1分ごとにクリーンアップ

export const _test_cleanup = () => {
    const now = Date.now();
    for (const [key, bucket] of _test_buckets.entries()) {
        if (now - bucket.lastRefill > TTL_MS) {
            _test_buckets.delete(key);
        }
    }
};

// スイーパー（古いエントリを定期削除）
if (typeof setInterval !== 'undefined') {
    setInterval(_test_cleanup, CLEANUP_INTERVAL_MS);
}

/**
 * Simple token bucket rate limiter (in-memory).
 * NOTE: This is best-effort and not suitable for multi-instance deployments.
 */
export function rateLimit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const bucket = _test_buckets.get(key) ?? { tokens: limit, lastRefill: now };

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
        bucketsMap().set(key, bucket);
        return { allowed: true, remaining: bucket.tokens };
    }

    // not allowed
    bucketsMap().set(key, bucket);
    return { allowed: false, remaining: 0 };
}

// 内部使用のMapアクセサ（テスト時の差し替え容易性のため... ではなくここでは export した map を使う）
function bucketsMap() {
    return _test_buckets;
}
