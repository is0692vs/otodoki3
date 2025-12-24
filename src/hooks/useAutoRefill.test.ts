import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAutoRefill } from './useAutoRefill';
import type { CardItem, Track } from '@/types/track-pool';

// Mock fetch
const mockFetch = vi.fn();

describe('useAutoRefill', () => {
    const originalFetch = global.fetch;

    beforeAll(() => {
        global.fetch = mockFetch;
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    beforeEach(() => {
        mockFetch.mockReset();
        // Default mock implementation to avoid undefined errors
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ tracks: [] }),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should not refill when stack is above threshold', () => {
        const stack: CardItem[] = Array(5).fill({
            type: 'track',
            track_id: '1',
            track_name: 'Test Track',
            artist_name: 'Test Artist',
            preview_url: 'http://example.com/preview.mp3'
        } as Track);
        const onRefill = vi.fn();

        renderHook(() => useAutoRefill(stack, onRefill));

        expect(onRefill).not.toHaveBeenCalled();
        // It might be called with default mock if we are not careful, but logic says it shouldn't call fetch
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should refill when stack is at or below threshold', async () => {
        const stack: CardItem[] = Array(3).fill({
            type: 'track',
            track_id: '1',
            track_name: 'Test Track',
            artist_name: 'Test Artist',
            preview_url: 'http://example.com/preview.mp3'
        } as Track);
        const onRefill = vi.fn();
        const newTracks = [{ track_id: '100' }, { track_id: '101' }];

        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ tracks: newTracks }),
        });

        renderHook(() => useAutoRefill(stack, onRefill));

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalled();
        });

        expect(onRefill).toHaveBeenCalledWith(newTracks);
    });

    it('should not refill if disableRefill is true', () => {
        const stack: CardItem[] = Array(1).fill({
            type: 'track',
            track_id: '1',
            track_name: 'Test Track',
            artist_name: 'Test Artist',
            preview_url: 'http://example.com/preview.mp3'
        } as Track);
        const onRefill = vi.fn();

        renderHook(() => useAutoRefill(stack, onRefill, true));

        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle fetch error', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stack: CardItem[] = Array(2).fill({ id: 1 } as any);
        const onRefill = vi.fn();

        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const { result } = renderHook(() => useAutoRefill(stack, onRefill));

        await waitFor(() => {
            expect(result.current.error).toBeTruthy();
        });

        expect(result.current.error?.message).toBe('Network error');
        expect(onRefill).not.toHaveBeenCalled();
    });

    it('should allow retry after error delay when triggered', async () => {
        vi.useFakeTimers();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stack: CardItem[] = Array(2).fill({ id: 1 } as any);
        const onRefill = vi.fn();

        // First attempt fails
        mockFetch.mockRejectedValueOnce(new Error('Fail 1'));

        const { result, rerender } = renderHook(
            ({ s }) => useAutoRefill(s, onRefill),
            { initialProps: { s: stack } }
        );

        // Wait for first failure
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(result.current.error).toBeTruthy();
        });

        // Advance time past retry delay (3000ms)
        vi.advanceTimersByTime(3000);

        // Second attempt succeeds
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ tracks: [{ id: 999 }] }),
        });

        // Trigger re-render to simulate component update or user interaction
        // We need to force the effect to run. The effect depends on [stack.length, isRefilling, refillTracks, disableRefill].
        // If we don't change stack length, it won't run.
        // But in reality, the user would swipe, reducing stack length.

        // Simulate stack reduction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newStack = Array(1).fill({ id: 1 } as any);
        rerender({ s: newStack });

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        expect(onRefill).toHaveBeenCalledWith([{ id: 999 }]);
    });
});
