import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rateLimit, _test_buckets, _test_cleanup } from './rateLimiter';

describe('rateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _test_buckets.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初期状態では許可される', () => {
    const result = rateLimit('test-key', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('制限を超えると拒否される', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('test-key', 5, 60000);
    }
    const result = rateLimit('test-key', 5, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('時間が経過するとトークンが補充される', () => {
    rateLimit('test-key', 5, 60000); // remaining 4
    expect(_test_buckets.get('test-key')?.tokens).toBe(4);

    // 30秒経過 (windowの半分) -> 約2.5トークン回復 -> max 5
    vi.advanceTimersByTime(30000);

    // 次の呼び出しで補充が走る
    const result = rateLimit('test-key', 5, 60000);
    // 4 + 2 = 6 -> max 5 -> consume 1 -> 4
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('TTLを過ぎたバケットはクリーンアップされる', () => {
    rateLimit('old-key', 5, 60000);
    expect(_test_buckets.has('old-key')).toBe(true);

    // TTL (10分) + 1秒 経過
    vi.advanceTimersByTime(10 * 60 * 1000 + 1000);

    // クリーンアップを実行 (setInterval経由か直接呼び出し)
    // setIntervalもfakeTimersで進んでいるはずだが、明示的に呼んでテスト
    _test_cleanup();

    expect(_test_buckets.has('old-key')).toBe(false);
  });
});
