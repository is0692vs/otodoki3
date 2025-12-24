import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutoRefill } from '@/hooks/useAutoRefill';
import type { CardItem } from '@/types/track-pool';

// モック CardItem
const mockTrack = (id: number): CardItem => ({
    type: 'track' as const,
    track_id: id,
    track_name: `Track ${id}`,
    artist_name: `Artist ${id}`,
    preview_url: `https://example.com/audio${id}.mp3`,
});

describe('useAutoRefill', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('初期状態が正しい', () => {
        const { result } = renderHook(() =>
            useAutoRefill([], vi.fn())
        );

        expect(result.current.isRefilling).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('disableRefill が true の場合、refill は実行されない', async () => {
        const onRefill = vi.fn();
        renderHook(() =>
            useAutoRefill([], onRefill, true)
        );

        await waitFor(() => {
            expect(onRefill).not.toHaveBeenCalled();
        });
    });

    it('正常系：clearError メソッドでエラーをクリアできる', async () => {
        const onRefill = vi.fn();
        global.fetch = vi.fn(() =>
            Promise.reject(new Error('Network error'))
        );

        const { result, rerender } = renderHook(
            ({ stack }: { stack: CardItem[] }) => useAutoRefill(stack, onRefill),
            { initialProps: { stack: [mockTrack(1)] } }
        );

        await act(async () => {
            rerender({ stack: [mockTrack(1)] });
        });

        await waitFor(() => {
            expect(result.current.error).not.toBeNull();
        });

        act(() => {
            result.current.clearError();
        });

        expect(result.current.error).toBeNull();
