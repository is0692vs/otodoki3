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
            text: async () => JSON.stringify({ tracks: [] }),
            headers: {
                get: (name: string) => name === 'content-type' ? 'application/json' : null
            },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should not refill when stack is above threshold', () => {
        const stack: CardItem[] = Array(5).fill({
            type: 'track',
            track_id: 1,
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
            track_id: 1,
            track_name: 'Test Track',
            artist_name: 'Test Artist',
            preview_url: 'http://example.com/preview.mp3'
        } as Track);
        const onRefill = vi.fn();
        const newTracks = [{ track_id: 100 }, { track_id: 101 }];

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ tracks: newTracks }),
            text: async () => JSON.stringify({ tracks: newTracks }),
            headers: {
                get: (name: string) => name === 'content-type' ? 'application/json' : null
            },
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
            track_id: 1,
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

    it.skip('should allow retry after error delay when triggered', async () => {
        // Use real timers to avoid issues with waitFor and fake timers
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

        // Wait for retry delay (3000ms) + buffer
        await new Promise(resolve => setTimeout(resolve, 3100));

        // Second attempt succeeds
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ tracks: [{ id: 999 }] }),
        });

        // Simulate stack reduction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newStack = Array(1).fill({ id: 1 } as any);
        rerender({ s: newStack });

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        expect(onRefill).toHaveBeenCalledWith([{ id: 999 }]);
    }, 10000); // Increase timeout for this test
});
