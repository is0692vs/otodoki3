import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rateLimit } from '@/lib/rateLimiter';

describe('rateLimiter.ts - rateLimit', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // 正常系：基本的な動作
    it('正常系：初回呼び出しでは allowed が true', () => {
        const result = rateLimit('test-key', 10, 1000);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9);
    });

    it('正常系：limit まで連続呼び出しが可能', () => {
        const limit = 5;
        for (let i = 0; i < limit; i++) {
            const result = rateLimit('test-key', limit, 1000);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(limit - 1 - i);
        }
    });

    it('正常系：limit を超えると allowed が false', () => {
        const limit = 3;
        for (let i = 0; i < limit; i++) {
            const result = rateLimit('test-key', limit, 1000);
            expect(result.allowed).toBe(true);
        }
        const result = rateLimit('test-key', limit, 1000);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('正常系：異なる key は独立している', () => {
        const result1 = rateLimit('key1', 2, 1000);
        const result2 = rateLimit('key1', 2, 1000);
        const result3 = rateLimit('key2', 2, 1000);

        expect(result1.allowed).toBe(true);
        expect(result2.allowed).toBe(true);
        expect(result3.allowed).toBe(true);

        const result4 = rateLimit('key1', 2, 1000);
        expect(result4.allowed).toBe(false);

        const result5 = rateLimit('key2', 2, 1000);
        expect(result5.allowed).toBe(true);
    });

    it('正常系：時間経過でトークンが補充される', () => {
        const limit = 5;
        const windowMs = 1000;

        const result1 = rateLimit('test-key', limit, windowMs);
        expect(result1.allowed).toBe(true);
        expect(result1.remaining).toBe(4);

        vi.advanceTimersByTime(500);
        const result2 = rateLimit('test-key', limit, windowMs);
        expect(result2.allowed).toBe(true);

        vi.advanceTimersByTime(600);
        const result3 = rateLimit('test-key', limit, windowMs);
        expect(result3.allowed).toBe(true);
    });

    it('正常系：時間経過により再度許可される', () => {
        const limit = 2;
        const windowMs = 1000;

        rateLimit('test-key', limit, windowMs);
        rateLimit('test-key', limit, windowMs);
        const result1 = rateLimit('test-key', limit, windowMs);
        expect(result1.allowed).toBe(false);

        vi.advanceTimersByTime(1100);
        const result2 = rateLimit('test-key', limit, windowMs);
        expect(result2.allowed).toBe(true);
    });

    // 異常系：エッジケース
    it('異常系：limit が 0 の場合、常に不許可', () => {
        const result1 = rateLimit('test-key', 0, 1000);
        expect(result1.allowed).toBe(false);
        expect(result1.remaining).toBe(0);

        const result2 = rateLimit('test-key', 0, 1000);
        expect(result2.allowed).toBe(false);
    });

    it('異常系：limit が負数の場合の動作', () => {
        const result = rateLimit('test-key', -5, 1000);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    // 複合シナリオ
    it('複合シナリオ：バースト後に時間経過して回復', () => {
        const limit = 3;
        const windowMs = 1000;

        for (let i = 0; i < limit; i++) {
            const result = rateLimit('test-key', limit, windowMs);
            expect(result.allowed).toBe(true);
        }

        const result1 = rateLimit('test-key', limit, windowMs);
        expect(result1.allowed).toBe(false);

        vi.advanceTimersByTime(1000);
        const result2 = rateLimit('test-key', limit, windowMs);
        expect(result2.allowed).toBe(true);
