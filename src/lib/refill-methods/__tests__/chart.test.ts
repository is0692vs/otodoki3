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

            await expect(fetchTracksFromChart(10)).rejects.toThrow();
        });

        it('タイムアウトは5秒で発生する', async () => {
            // 10秒かかる遅いレスポンスをモック
            const slowFetch = jest.fn().mockImplementation(() => 
                new Promise((resolve) => {
                    setTimeout(() => resolve({
                        ok: true,
                        status: 200,
                        json: async () => ({ feed: { results: [] } })
                    }), 10000);
                })
            );
            global.fetch = slowFetch as jest.Mock;

            // 5秒でタイムアウトするはず
            await expect(fetchTracksFromChart(10)).rejects.toThrow();
            
            expect(slowFetch).toHaveBeenCalled();
        }, 15000); // テスト自体のタイムアウトは15秒

        it('空の結果を返しても例外を投げない', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    feed: {
                        results: [],
                    },
                }),
            }) as jest.Mock;

            const tracks = await fetchTracksFromChart(10);
            expect(tracks).toEqual([]);
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
                    json: async () => ({ feed: { results: [] } }),
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

            await expect(fetchTracksFromChartWithRetry(10, 2)).rejects.toThrow();
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
                    json: async () => ({ feed: { results: [] } }),
                };
            }) as jest.Mock;

            await fetchTracksFromChartWithRetry(10, 3);
            expect(attempts).toBe(2);
        });
    });
});
