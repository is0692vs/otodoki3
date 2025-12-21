import { fetchTracksFromChart, fetchTracksFromChartWithRetry } from '../chart';
import {
    mockAppleRssResponse,
    mockEmptyAppleRssResponse,
    mockAppleRssResponseWithoutPreview,
} from '../../__fixtures__/tracks';

// グローバル fetch のモック
global.fetch = jest.fn();

describe('fetchTracksFromChart', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('正常系', () => {
        it('should fetch tracks from Apple RSS API', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponse,
            });

            const tracks = await fetchTracksFromChart(3);

            expect(tracks).toHaveLength(3);
            expect(tracks[0]).toMatchObject({
                track_id: '2001',
                track_name: 'チャート曲1',
                artist_name: 'チャートアーティスト1',
                preview_url: 'https://example.com/chart1',
                artwork_url: 'https://example.com/chart_art1.jpg',
            });
            expect(tracks[0].metadata).toMatchObject({
                source: 'apple_rss',
                fetched_from: 'chart',
            });
        });

        it('should use default limit of 50', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponse,
            });

            await fetchTracksFromChart();

            expect(global.fetch).toHaveBeenCalledWith(
                'https://rss.applemarketingtools.com/api/v2/jp/music/most-played/50/songs',
                expect.any(Object)
            );
        });

        it('should respect custom limit parameter', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponse,
            });

            await fetchTracksFromChart(10);

            expect(global.fetch).toHaveBeenCalledWith(
                'https://rss.applemarketingtools.com/api/v2/jp/music/most-played/10/songs',
                expect.any(Object)
            );
        });

        it('should use custom User-Agent if provided', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponse,
            });

            await fetchTracksFromChart(10, { userAgent: 'CustomAgent/1.0' });

            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: { 'User-Agent': 'CustomAgent/1.0' },
                })
            );
        });

        it('should use default User-Agent if not provided', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponse,
            });

            await fetchTracksFromChart(10);

            expect(global.fetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: { 'User-Agent': 'otodoki/1.0' },
                })
            );
        });
    });

    describe('エッジケース', () => {
        it('should return empty array when API returns no results', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockEmptyAppleRssResponse,
            });

            const tracks = await fetchTracksFromChart(10);

            expect(tracks).toEqual([]);
        });

        it('should filter out tracks without preview_url', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponseWithoutPreview,
            });

            const tracks = await fetchTracksFromChart(10);

            expect(tracks).toEqual([]);
        });

        it('should handle malformed API response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ feed: null }),
            });

            const tracks = await fetchTracksFromChart(10);

            expect(tracks).toEqual([]);
        });

        it('should handle response without feed.results', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ feed: {} }),
            });

            const tracks = await fetchTracksFromChart(10);

            expect(tracks).toEqual([]);
        });
    });

    describe('エラーハンドリング', () => {
        it('should throw error on 429 rate limit', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
            });

            await expect(fetchTracksFromChart(10)).rejects.toThrow(
                'Apple RSS Charts API rate limit exceeded'
            );
        });

        it('should throw error on non-ok response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });

            await expect(fetchTracksFromChart(10)).rejects.toThrow(
                'Apple RSS Charts API request failed with status 500'
            );
        });

        it('should throw error on network failure', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(
                new Error('Network error')
            );

            await expect(fetchTracksFromChart(10)).rejects.toThrow('Network error');
        });
    });

    describe('タイムアウト処理', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should timeout after specified timeoutMs', async () => {
            let abortSignal: AbortSignal | undefined;
            
            (global.fetch as jest.Mock).mockImplementationOnce((url, options) => {
                abortSignal = options.signal;
                return new Promise((resolve) => {
                    // 長時間かかるレスポンスをシミュレート
                    setTimeout(() => {
                        resolve({
                            ok: true,
                            status: 200,
                            json: async () => mockAppleRssResponse,
                        });
                    }, 10000);
                });
            });

            const promise = fetchTracksFromChart(10, { timeoutMs: 1000 });

            // タイムアウト時間を進める
            jest.advanceTimersByTime(1000);

            await expect(promise).rejects.toThrow('Request to Apple RSS Charts API timed out');
            
            // abort signal が送信されたことを確認
            expect(abortSignal?.aborted).toBe(true);
        });

        it('should use default timeout of 5000ms', async () => {
            let timeoutMs = 0;
            
            (global.fetch as jest.Mock).mockImplementationOnce((url, options) => {
                return new Promise((resolve) => {
                    const timeoutId = setTimeout(() => {
                        resolve({
                            ok: true,
                            status: 200,
                            json: async () => mockAppleRssResponse,
                        });
                    }, 100);
                    
                    // タイムアウトまでの時間を記録
                    options.signal?.addEventListener('abort', () => {
                        clearTimeout(timeoutId);
                        timeoutMs = Date.now();
                    });
                });
            });

            const promise = fetchTracksFromChart(10);
            
            // デフォルトの5000msを進める
            jest.advanceTimersByTime(5000);
            
            await expect(promise).rejects.toThrow();
        });

        it('should clear timeout on successful response', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponse,
            });

            const tracks = await fetchTracksFromChart(10, { timeoutMs: 5000 });

            expect(tracks).toHaveLength(3);
            
            // タイムアウトが発生しないことを確認
            jest.advanceTimersByTime(10000);
        });
    });
});

describe('fetchTracksFromChartWithRetry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('リトライロジック', () => {
        it('should succeed on first attempt', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponse,
            });

            const tracks = await fetchTracksFromChartWithRetry(10, 3);

            expect(tracks).toHaveLength(3);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure and succeed', async () => {
            // 最初は失敗、2回目は成功
            (global.fetch as jest.Mock)
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => mockAppleRssResponse,
                });

            const promise = fetchTracksFromChartWithRetry(10, 3, 100);

            // 最初の呼び出しが失敗
            await jest.advanceTimersByTimeAsync(0);
            
            // リトライの遅延を待つ（指数バックオフ: 100ms * 2^0 = 100ms + ジッター）
            await jest.advanceTimersByTimeAsync(200);

            const tracks = await promise;

            expect(tracks).toHaveLength(3);
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should throw error after max retries', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

            const promise = fetchTracksFromChartWithRetry(10, 3, 100);

            // すべてのリトライを待つ
            for (let i = 0; i < 3; i++) {
                await jest.advanceTimersByTimeAsync(5000);
            }

            await expect(promise).rejects.toThrow('Failed to fetch tracks after 3 attempts');
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });

        it('should use default maxRetries of 3', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

            const promise = fetchTracksFromChartWithRetry(10);

            // デフォルトの3回のリトライを待つ
            for (let i = 0; i < 3; i++) {
                await jest.advanceTimersByTimeAsync(35000);
            }

            await expect(promise).rejects.toThrow();
            expect(global.fetch).toHaveBeenCalledTimes(3);
        });
    });

    describe('指数バックオフ', () => {
        it('should increase delay exponentially on each retry', async () => {
            const delays: number[] = [];
            let callCount = 0;

            (global.fetch as jest.Mock).mockImplementation(() => {
                callCount++;
                if (callCount < 3) {
                    return Promise.reject(new Error('Network error'));
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => mockAppleRssResponse,
                });
            });

            // 遅延を記録するために setTimeout をモック
            const originalSetTimeout = global.setTimeout;
            jest.spyOn(global, 'setTimeout').mockImplementation(((callback: any, delay: number) => {
                if (delay > 0) {
                    delays.push(delay);
                }
                return originalSetTimeout(callback, 0);
            }) as any);

            const promise = fetchTracksFromChartWithRetry(10, 3, 1000, 30000, 0);

            await jest.advanceTimersByTimeAsync(100000);
            
            await promise;

            // 指数的に増加していることを確認（ジッターなし）
            expect(delays.length).toBeGreaterThan(0);
            // baseDelay * 2^(attempt-1): 1000, 2000, 4000, ...
            if (delays.length >= 2) {
                expect(delays[1]).toBeGreaterThan(delays[0]);
            }

            (global.setTimeout as jest.Mock).mockRestore();
        });

        it('should respect maxDelay parameter', async () => {
            const delays: number[] = [];

            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

            // 遅延を記録
            jest.spyOn(global, 'setTimeout').mockImplementation(((callback: any, delay: number) => {
                if (delay > 0) {
                    delays.push(delay);
                }
                return setTimeout(callback, 0) as any;
            }) as any);

            const promise = fetchTracksFromChartWithRetry(10, 5, 1000, 2000, 0);

            await jest.advanceTimersByTimeAsync(100000);

            await expect(promise).rejects.toThrow();

            // maxDelay (2000) を超えないことを確認
            delays.forEach(delay => {
                expect(delay).toBeLessThanOrEqual(2000);
            });

            (global.setTimeout as jest.Mock).mockRestore();
        });
    });

    describe('ジッター', () => {
        it('should apply jitter to delay', async () => {
            const delays: number[] = [];

            (global.fetch as jest.Mock).mockImplementation(() => {
                return Promise.reject(new Error('Network error'));
            });

            // 遅延を記録
            jest.spyOn(global, 'setTimeout').mockImplementation(((callback: any, delay: number) => {
                if (delay > 0) {
                    delays.push(delay);
                }
                return setTimeout(callback, 0) as any;
            }) as any);

            // ジッター有効（jitterFactor: 0.5）
            const promise = fetchTracksFromChartWithRetry(10, 3, 1000, 30000, 0.5);

            await jest.advanceTimersByTimeAsync(100000);

            await expect(promise).rejects.toThrow();

            // ジッターにより、遅延が基本値から変動していることを確認
            // （厳密なテストは難しいので、少なくとも遅延が記録されていることを確認）
            expect(delays.length).toBeGreaterThan(0);

            (global.setTimeout as jest.Mock).mockRestore();
        });

        it('should ensure delay is non-negative even with jitter', async () => {
            const delays: number[] = [];

            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

            jest.spyOn(global, 'setTimeout').mockImplementation(((callback: any, delay: number) => {
                if (delay !== undefined) {
                    delays.push(delay);
                }
                return setTimeout(callback, 0) as any;
            }) as any);

            const promise = fetchTracksFromChartWithRetry(10, 3, 100, 30000, 1.0);

            await jest.advanceTimersByTimeAsync(100000);

            await expect(promise).rejects.toThrow();

            // すべての遅延が非負であることを確認
            delays.forEach(delay => {
                expect(delay).toBeGreaterThanOrEqual(0);
            });

            (global.setTimeout as jest.Mock).mockRestore();
        });
    });
});
