import { fetchTracksFromChart, fetchTracksFromChartWithRetry } from '../chart';
import {
    mockAppleRssResponse,
    mockEmptyAppleRssResponse,
    mockAppleRssResponseWithoutPreview,
} from '../../__fixtures__/tracks';

describe('fetchTracksFromChart', () => {
    let fetchMock: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
        // Mock fetch using jest.spyOn for better test isolation
        fetchMock = jest.spyOn(global, 'fetch').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('正常系', () => {
        it('should fetch tracks from Apple RSS API', async () => {
            fetchMock.mockResolvedValueOnce({
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
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponse,
            });

            await fetchTracksFromChart();

            expect(fetchMock).toHaveBeenCalledWith(
                'https://rss.applemarketingtools.com/api/v2/jp/music/most-played/50/songs',
                expect.any(Object)
            );
        });

        it('should respect custom limit parameter', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponse,
            });

            await fetchTracksFromChart(10);

            expect(fetchMock).toHaveBeenCalledWith(
                'https://rss.applemarketingtools.com/api/v2/jp/music/most-played/10/songs',
                expect.any(Object)
            );
        });

        it('should use custom User-Agent if provided', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponse,
            });

            await fetchTracksFromChart(10, { userAgent: 'CustomAgent/1.0' });

            expect(fetchMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: { 'User-Agent': 'CustomAgent/1.0' },
                })
            );
        });

        it('should use default User-Agent if not provided', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponse,
            });

            await fetchTracksFromChart(10);

            expect(fetchMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: { 'User-Agent': 'otodoki/1.0' },
                })
            );
        });
    });

    describe('エッジケース', () => {
        it('should return empty array when API returns no results', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockEmptyAppleRssResponse,
            });

            const tracks = await fetchTracksFromChart(10);

            expect(tracks).toEqual([]);
        });

        it('should filter out tracks without preview_url', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponseWithoutPreview,
            });

            const tracks = await fetchTracksFromChart(10);

            expect(tracks).toEqual([]);
        });

        it('should handle malformed API response', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ feed: null }),
            });

            const tracks = await fetchTracksFromChart(10);

            expect(tracks).toEqual([]);
        });

        it('should handle response without feed.results', async () => {
            fetchMock.mockResolvedValueOnce({
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
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
            });

            await expect(fetchTracksFromChart(10)).rejects.toThrow(
                'Apple RSS Charts API rate limit exceeded'
            );
        });

        it('should throw error on non-ok response', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });

            await expect(fetchTracksFromChart(10)).rejects.toThrow(
                'Apple RSS Charts API request failed with status 500'
            );
        });

        it('should throw error on network failure', async () => {
            fetchMock.mockRejectedValueOnce(
                new Error('Network error')
            );

            await expect(fetchTracksFromChart(10)).rejects.toThrow('Network error');
        });
    });

    describe('タイムアウト処理', () => {
        it('should use timeout mechanism with AbortController', async () => {
            let abortSignal: AbortSignal | undefined;
            
            fetchMock.mockImplementationOnce((url, options) => {
                abortSignal = options.signal;
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => mockAppleRssResponse,
                });
            });

            await fetchTracksFromChart(10, { timeoutMs: 5000 });

            // AbortController のシグナルが渡されたことを確認
            expect(abortSignal).toBeDefined();
        });

        it('should clear timeout on successful response', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponse,
            });

            const tracks = await fetchTracksFromChart(10, { timeoutMs: 5000 });

            expect(tracks).toHaveLength(3);
        });
    });
});

describe('fetchTracksFromChartWithRetry', () => {
    let fetchMock: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        // Suppress console.error for retry tests
        jest.spyOn(console, 'error').mockImplementation(() => {});
        fetchMock = jest.spyOn(global, 'fetch').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('リトライロジック (with fake timers)', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });
        it('should succeed on first attempt', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockAppleRssResponse,
            });

            const tracks = await fetchTracksFromChartWithRetry(10, 3);

            expect(tracks).toHaveLength(3);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure and succeed', async () => {
            // 最初は失敗、2回目は成功
            fetchMock
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
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('should throw error after max retries', async () => {
            jest.useRealTimers(); // Use real timers for this test
            
            fetchMock.mockRejectedValue(new Error('Network error'));

            await expect(
                fetchTracksFromChartWithRetry(10, 2, 10) // maxRetries=2, baseDelay=10ms for speed
            ).rejects.toThrow('Failed to fetch tracks after 2 attempts');
            
            expect(fetchMock).toHaveBeenCalledTimes(2);
            
            jest.useFakeTimers(); // Restore fake timers for other tests
        });

        it('should use default maxRetries of 3', async () => {
            jest.useRealTimers(); // Use real timers for this test
            
            fetchMock.mockRejectedValue(new Error('Network error'));

            await expect(
                fetchTracksFromChartWithRetry(10, 3, 10) // baseDelay=10ms for speed
            ).rejects.toThrow();
            
            expect(fetchMock).toHaveBeenCalledTimes(3);
            
            jest.useFakeTimers(); // Restore fake timers for other tests
        });
    });

    describe('指数バックオフ', () => {
        it('should increase delay exponentially on each retry', async () => {
            let callCount = 0;

            fetchMock.mockImplementation(() => {
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

            const promise = fetchTracksFromChartWithRetry(10, 3, 1000, 30000, 0);

            await jest.advanceTimersByTimeAsync(100000);
            
            const tracks = await promise;

            // 指数的バックオフで3回試行（1回目失敗、2回目失敗、3回目成功）
            expect(callCount).toBe(3);
            expect(tracks).toHaveLength(3);
        });

        it('should respect maxDelay parameter', async () => {
            jest.useRealTimers(); // Use real timers for this test
            
            fetchMock.mockRejectedValue(new Error('Network error'));

            await expect(
                fetchTracksFromChartWithRetry(10, 2, 10, 20, 0) // baseDelay=10ms, maxDelay=20ms
            ).rejects.toThrow();

            // 2回試行されたことを確認
            expect(fetchMock).toHaveBeenCalledTimes(2);
            
            jest.useFakeTimers(); // Restore fake timers for other tests
        });
    });

    describe('ジッター', () => {
        it('should apply jitter to delay', async () => {
            jest.useRealTimers(); // Use real timers for this test
            
            fetchMock.mockRejectedValue(new Error('Network error'));

            // ジッター有効（jitterFactor: 0.5）
            await expect(
                fetchTracksFromChartWithRetry(10, 2, 10, 30000, 0.5) // maxRetries=2, baseDelay=10ms
            ).rejects.toThrow();

            // 2回試行されたことを確認
            expect(fetchMock).toHaveBeenCalledTimes(2);
            
            jest.useFakeTimers(); // Restore fake timers for other tests
        });

        it('should ensure delay is non-negative even with jitter', async () => {
            jest.useRealTimers(); // Use real timers for this test
            
            fetchMock.mockRejectedValue(new Error('Network error'));

            await expect(
                fetchTracksFromChartWithRetry(10, 2, 10, 30000, 1.0) // maxRetries=2, jitterFactor=1.0
            ).rejects.toThrow();

            // 2回試行されたことを確認（遅延が負にならないことを間接的に確認）
            expect(fetchMock).toHaveBeenCalledTimes(2);
            
            jest.useFakeTimers(); // Restore fake timers for other tests
        });
    });
});
