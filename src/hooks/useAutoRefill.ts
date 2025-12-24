import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardItem } from '@/types/track-pool';

// 定数定義
const REFILL_THRESHOLD = 3; // カード残数がこの値以下になったら補充
const RETRY_DELAY_MS = 3000; // エラー時の再試行待機時間（ミリ秒）
const FETCH_TIMEOUT_MS = 10000; // fetch タイムアウト時間（ミリ秒）

export function useAutoRefill(
    stack: CardItem[],
    onRefill: (newTracks: CardItem[]) => void
) {
    const [isRefilling, setIsRefilling] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const hasRequestedRef = useRef(false);
    const swipeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const refillTracks = useCallback(async () => {
        setIsRefilling(true);
        setError(null);

        // タイムアウト設定
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            // 既存の初回ロードと同じエンドポイントを使用
            const response = await fetch('/api/tracks/random', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Failed to refill tracks: ${response.status}`);
            }

            const data = await response.json();
            const newTracks: CardItem[] = data.tracks || [];

            if (newTracks.length > 0) {
                onRefill(newTracks);
                console.log(`Refilled ${newTracks.length} tracks`);
                // 成功時は即座にリセット
                hasRequestedRef.current = false;
            } else {
                console.warn('No tracks returned from refill API');
                // 成功時は即座にリセット
                hasRequestedRef.current = false;
            }
        } catch (err) {
            clearTimeout(timeoutId);
            const error = err instanceof Error ? err : new Error('Unknown error');
            setError(error);
            console.error('Failed to refill tracks:', error);

            // エラー時のみ遅延後にリセット
            if (swipeTimeoutRef.current) {
                clearTimeout(swipeTimeoutRef.current);
            }
            swipeTimeoutRef.current = setTimeout(() => {
                hasRequestedRef.current = false;
            }, RETRY_DELAY_MS);
        } finally {
            setIsRefilling(false);
        }
    }, [onRefill]);

    // クリーンアップ用useEffect
    useEffect(() => {
        return () => {
            if (swipeTimeoutRef.current) {
                clearTimeout(swipeTimeoutRef.current);
            }
        };
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    useEffect(() => {
        // 閾値以下かつ補充中でない場合
        if (stack.length <= REFILL_THRESHOLD && !isRefilling && !hasRequestedRef.current) {
            hasRequestedRef.current = true;
            refillTracks();
        }

        // スタックが増えたらフラグをリセット（次回補充を許可）
        if (stack.length > REFILL_THRESHOLD) {
            hasRequestedRef.current = false;
        }
    }, [stack.length, isRefilling, refillTracks]);

    return { isRefilling, error, clearError };
}
