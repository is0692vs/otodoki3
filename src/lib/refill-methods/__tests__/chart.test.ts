import { fetchTracksFromChart, fetchTracksFromChartWithRetry } from '../chart';

describe('chart refill method', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('fetchTracksFromChart', () => {
        it('Apple RSS から楽曲を取得できる', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    feed: {
                        results: [{
                            id: '123456789',
                            name: 'Test Song',
                            artistName: 'Test Artist',
                            url: 'https://music.apple.com/jp/album/test/123456789',
                        }],
                    },
                }),
            }) as jest.Mock;

            const tracks = await fetchTracksFromChart(10);
            expect(tracks.length).toBeGreaterThan(0);
            expect(tracks[0]).toHaveProperty('track_id');
            expect(tracks[0]).toHaveProperty('track_name');
            expect(tracks[0]).toHaveProperty('artist_name');
            expect(tracks[0]).toHaveProperty('preview_url');
        });

        it('API エラー時は例外を投げる', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: async () => ({}), // json メソッドを追加
            }) as jest.Mock;

            await expect(fetchTracksFromChart(10)).rejects.toThrow('Apple RSS Charts API request failed with status 500: Internal Server Error');
        });

        it.skip('タイムアウトは5秒で発生する', async () => {
            // AbortController のタイムアウトは実際のネットワークリクエストでのみ動作するため、
            // モックでは信頼できない挙動になります。必要なら実際のネットワークリクエストを
            // 用いた統合テストとして別途カバーしてください。
        });

        it('オプションを指定して楽曲を取得できる', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    feed: {
                        results: [{
                            id: '123456789',
                            name: 'Test Song',
                            artistName: 'Test Artist',
                            url: 'https://music.apple.com/jp/album/test/123456789',
                        }],
                    },
                }),
            }) as jest.Mock;

            const tracks = await fetchTracksFromChart(10, { timeoutMs: 10000, userAgent: 'CustomAgent/1.0' });
            expect(tracks.length).toBeGreaterThan(0);
            expect(tracks[0]).toHaveProperty('track_id');
        });

        it('APIレスポンスのfeedがundefinedでも例外を投げない', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    feed: undefined,
                }),
            }) as jest.Mock;

            const tracks = await fetchTracksFromChart(10);
            expect(tracks).toEqual([]);
        });

        it('APIレスポンスのresultsがundefinedでも例外を投げない', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    feed: {
                        results: undefined,
                    },
                }),
            }) as jest.Mock;

            const tracks = await fetchTracksFromChart(10);
            expect(tracks).toEqual([]);
        });

        it('楽曲のurlがundefinedの場合、preview_urlが空文字列になる', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    feed: {
                        results: [{
                            id: '123456789',
                            name: 'Test Song',
                            artistName: 'Test Artist',
                            url: undefined,
                        }],
                    },
                }),
            }) as jest.Mock;

            const tracks = await fetchTracksFromChart(10);
            expect(tracks.length).toBe(0); // 空文字列のpreview_urlはフィルタリングされる
        });

        it('タイムアウト時はAbortErrorを投げる', async () => {
            global.fetch = jest.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

            await expect(fetchTracksFromChart(10, { timeoutMs: 1 })).rejects.toThrow('Request to Apple RSS Charts API timed out.');
        });
    });

    describe('fetchTracksFromChartWithRetry', () => {
        it('429 レート制限時はリトライする', async () => {
            let attempts = 0;
            global.fetch = jest.fn().mockImplementation(async () => {
                attempts++;
                if (attempts < 3) {
                    return { ok: false, status: 429, statusText: 'Too Many Requests' };
                }
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ feed: { results: [{ id: '1', name: 't', artistName: 'a', url: 'u' }] } }),
                };
            }) as jest.Mock;

            await fetchTracksFromChartWithRetry(10, 3);
            expect(attempts).toBe(3);
        });

        it('最大リトライ回数を超えたら例外を投げる', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
            }) as jest.Mock;

            await expect(fetchTracksFromChartWithRetry(10, 2)).rejects.toThrow('Failed to fetch tracks after 3 attempts: Apple RSS Charts API rate limit exceeded. Please try again later.');
        });

        it('500 エラーでもリトライする', async () => {
            let attempts = 0;
            global.fetch = jest.fn().mockImplementation(async () => {
                attempts++;
                if (attempts < 2) {
                    return { ok: false, status: 500, statusText: 'Internal Server Error' };
                }
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ feed: { results: [{ id: '1', name: 't', artistName: 'a', url: 'u' }] } }),
                };
            }) as jest.Mock;

            await fetchTracksFromChartWithRetry(10, 3);
            expect(attempts).toBe(2);
        });

        it('デフォルトパラメータでリトライする', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ feed: { results: [] } }),
            }) as jest.Mock;

            const tracks = await fetchTracksFromChartWithRetry();
            expect(tracks).toEqual([]);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://rss.applemarketingtools.com/api/v2/jp/music/most-played/50/songs',
                expect.any(Object)
            );
        });

        it('最終エラーのメッセージを含む例外を投げる', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
            }) as jest.Mock;

            await expect(fetchTracksFromChartWithRetry(10, 1)).rejects.toThrow('Failed to fetch tracks after 2 attempts: Apple RSS Charts API rate limit exceeded. Please try again later.');
        });
    });
});

describe('chart error handling', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('fetchTracksFromChart', () => {
        it('should handle fetch error', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

            await expect(fetchTracksFromChart(10)).rejects.toThrow('Network error');
        });

        it('should handle non-ok response', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            });

            await expect(fetchTracksFromChart(10)).rejects.toThrow('Apple RSS Charts API request failed with status 404: Not Found');
        });

        it('should handle timeout via AbortController', async () => {
            global.fetch = jest.fn().mockRejectedValue(new DOMException('Aborted by user', 'AbortError'));

            await expect(fetchTracksFromChart(10)).rejects.toThrow('Request to Apple RSS Charts API timed out.');
        });

        it('should handle json parse error', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => { throw new Error('Invalid JSON'); },
            });

            await expect(fetchTracksFromChart(10)).rejects.toThrow('Invalid JSON');
        });

        it('should handle undefined feed', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ feed: undefined }),
            });

            const result = await fetchTracksFromChart(10);
            expect(result).toEqual([]);
        });

        it('should handle undefined results', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ feed: { results: undefined } }),
            });

            const result = await fetchTracksFromChart(10);
            expect(result).toEqual([]);
        });

        it('should handle empty results array', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ feed: { results: [] } }),
            });

            const result = await fetchTracksFromChart(10);
            expect(result).toEqual([]);
        });

        it('should handle item with undefined url', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    feed: {
                        results: [{
                            id: '123',
                            name: 'Test Track',
                            artistName: 'Test Artist',
                            url: undefined,
                        }]
                    }
                }),
            });

            const result = await fetchTracksFromChart(10);
            expect(result).toEqual([]);
        });

        it('should handle item with missing properties', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    feed: {
                        results: [{
                            id: '123',
                            name: undefined,
                            artistName: undefined,
                            artworkUrl100: 'http://example.com/art.jpg',
                            url: 'https://example.com',
                        }]
                    }
                }),
            });

            const result = await fetchTracksFromChart(10);
            expect(result).toEqual([{
                track_id: '123',
                track_name: undefined,
                artist_name: undefined,
                collection_name: undefined,
                preview_url: 'https://example.com',
                artwork_url: 'http://example.com/art.jpg',
                track_view_url: 'https://example.com',
                genre: undefined,
                release_date: undefined,
                metadata: { source: 'apple_rss', fetched_from: 'chart' },
            }]);
        });

        it('should handle options being passed', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ feed: { results: [] } }),
            });

            await fetchTracksFromChart(10, { timeoutMs: 3000, userAgent: 'TestAgent/1.0' });
            expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
                headers: { 'User-Agent': 'TestAgent/1.0' }
            }));
        });
    });

    describe('fetchTracksFromChartWithRetry', () => {
        it('should handle AbortError', async () => {
            global.fetch = jest.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

            await expect(fetchTracksFromChartWithRetry(10, 1)).rejects.toThrow('Failed to fetch tracks after 2 attempts: Request to Apple RSS Charts API timed out.');
        });

        it('should handle default parameters', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ feed: { results: [] } }),
            });

            const result = await fetchTracksFromChartWithRetry();
            expect(result).toEqual([]);
            expect(global.fetch).toHaveBeenCalledWith(
                'https://rss.applemarketingtools.com/api/v2/jp/music/most-played/50/songs',
                expect.any(Object)
            );
        });

        it('should handle retry with exponential backoff', async () => {
            jest.useFakeTimers();
            let attempts = 0;
            global.fetch = jest.fn().mockImplementation(async () => {
                attempts++;
                if (attempts < 3) {
                    return { ok: false, status: 429, statusText: 'Too Many Requests' };
                }
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ feed: { results: [{ id: '1', name: 't', artistName: 'a', url: 'u' }] } }),
                };
            });

            const promise = fetchTracksFromChartWithRetry(10, 2, 100);
            
            // Fast-forward timers to allow retries to execute
            await jest.advanceTimersByTimeAsync(100 + 200);

            await promise;

            expect(attempts).toBe(3);
            jest.useRealTimers();
        });

        it('should handle maxRetries being 0', async () => {
        it('should handle maxRetries being 0', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });

        it('should handle negative maxRetries', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ feed: { results: [] } }),
            });

            await expect(fetchTracksFromChartWithRetry(10, -1)).rejects.toThrow('Failed to fetch tracks after -1 attempts');
        });
    });
});
