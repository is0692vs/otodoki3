import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRandomTracks } from './tracks';

describe('fetchRandomTracks', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        global.fetch = fetchMock;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('正常系', () => {
        it('指定した数のトラックを取得できる', async () => {
            const mockTracks = [
                {
                    type: 'track',
                    track_id: 1,
                    track_name: 'Test Track 1',
                    artist_name: 'Test Artist 1',
                    preview_url: 'https://example.com/preview1.mp3',
                },
                {
                    type: 'track',
                    track_id: 2,
                    track_name: 'Test Track 2',
                    artist_name: 'Test Artist 2',
                    preview_url: 'https://example.com/preview2.mp3',
                },
            ];

            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true, tracks: mockTracks }),
            } as Response);

            const result = await fetchRandomTracks(2);

            expect(fetchMock).toHaveBeenCalledWith('/api/tracks/random?count=2');
            expect(result).toEqual(mockTracks);
            expect(result).toHaveLength(2);
        });

        it('countパラメータが正しくURLに含まれる', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true, tracks: [] }),
            } as Response);

            await fetchRandomTracks(10);

            expect(fetchMock).toHaveBeenCalledWith('/api/tracks/random?count=10');
        });

        it('空の配列が返される場合も正しく処理できる', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true, tracks: [] }),
            } as Response);

            const result = await fetchRandomTracks(5);

            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
        });

        it('大量のトラックを取得できる', async () => {
            const mockTracks = Array.from({ length: 100 }, (_, i) => ({
                type: 'track',
                track_id: i + 1,
                track_name: `Track ${i + 1}`,
                artist_name: `Artist ${i + 1}`,
                preview_url: `https://example.com/preview${i + 1}.mp3`,
            }));

            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true, tracks: mockTracks }),
            } as Response);

            const result = await fetchRandomTracks(100);

            expect(result).toHaveLength(100);
        });
    });

    describe('エラーハンドリング', () => {
        it('HTTPエラーの場合は例外をスローする', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 500,
                json: async () => ({ success: false, error: 'Internal Server Error' }),
            } as Response);

            await expect(fetchRandomTracks(5)).rejects.toThrow('Internal Server Error');
        });

        it('success=falseの場合は例外をスローする', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: false, error: 'No tracks available' }),
            } as Response);

            await expect(fetchRandomTracks(5)).rejects.toThrow('No tracks available');
        });

        it('エラーメッセージがない場合はデフォルトメッセージをスローする', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({ success: false }),
            } as Response);

            await expect(fetchRandomTracks(5)).rejects.toThrow('Failed to fetch tracks');
        });

        it('ネットワークエラーの場合は例外をスローする', async () => {
            fetchMock.mockRejectedValueOnce(new Error('Network error'));

            await expect(fetchRandomTracks(5)).rejects.toThrow('Network error');
        });

        it('401 Unauthorizedエラーを正しく処理する', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ success: false, error: 'Unauthorized' }),
            } as Response);

            await expect(fetchRandomTracks(5)).rejects.toThrow('Unauthorized');
        });

        it('429 Rate Limitエラーを正しく処理する', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                status: 429,
                json: async () => ({ success: false, error: 'Too Many Requests' }),
            } as Response);

            await expect(fetchRandomTracks(5)).rejects.toThrow('Too Many Requests');
        });
    });

    describe('エッジケース', () => {
        it('count=0の場合も正しく処理できる', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true, tracks: [] }),
            } as Response);

            const result = await fetchRandomTracks(0);

            expect(fetchMock).toHaveBeenCalledWith('/api/tracks/random?count=0');
            expect(result).toEqual([]);
        });

        it('負の値のcountでも正しく処理できる', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true, tracks: [] }),
            } as Response);

            await fetchRandomTracks(-1);

            expect(fetchMock).toHaveBeenCalledWith('/api/tracks/random?count=-1');
        });

        it('トラックデータの形式が正しいことを検証する', async () => {
            const mockTrack = {
                type: 'track',
                track_id: 123,
                track_name: 'Complete Track',
                artist_name: 'Complete Artist',
                collection_name: 'Complete Album',
                preview_url: 'https://example.com/preview.mp3',
                artwork_url: 'https://example.com/artwork.jpg',
                track_view_url: 'https://music.apple.com/track/123',
                genre: 'Pop',
                release_date: '2024-01-01',
                metadata: { source: 'test' },
            };

            fetchMock.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true, tracks: [mockTrack] }),
            } as Response);

            const result = await fetchRandomTracks(1);

            expect(result[0]).toMatchObject(mockTrack);
        });
    });
});