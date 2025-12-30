import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { createMockSupabaseClient, mockAuthenticatedUser } from '@/test/api-test-utils';

// Supabase クライアントをモック
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
}));

const { createClient } = await import('@/lib/supabase/server');

describe('GET /api/playlists/dislikes', () => {
    let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase = createMockSupabaseClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    });

    describe('正常系', () => {
        it('認証済みユーザーが興味なしトラック一覧を取得できる', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            const mockDislikesData = [
                {
                    track_id: '12345',
                    created_at: '2024-01-01T00:00:00.000Z',
                    track_pool: [
                        {
                            track_name: 'Disliked Track 1',
                            artist_name: 'Artist 1',
                            artwork_url: 'https://example.com/artwork1.jpg',
                            preview_url: 'https://example.com/preview1.mp3',
                        },
                    ],
                },
                {
                    track_id: '67890',
                    created_at: '2024-01-02T00:00:00.000Z',
                    track_pool: [
                        {
                            track_name: 'Disliked Track 2',
                            artist_name: 'Artist 2',
                            artwork_url: 'https://example.com/artwork2.jpg',
                            preview_url: 'https://example.com/preview2.mp3',
                        },
                    ],
                },
            ];

            mockSupabase.mockOrder.mockResolvedValue({
                data: mockDislikesData,
                error: null,
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.tracks).toHaveLength(2);

            expect(data.tracks[0]).toMatchObject({
                track_id: 12345,
                type: 'track',
                track_name: 'Disliked Track 1',
                artist_name: 'Artist 1',
                artwork_url: 'https://example.com/artwork1.jpg',
                preview_url: 'https://example.com/preview1.mp3',
                created_at: '2024-01-01T00:00:00.000Z',
            });

            expect(data.tracks[1]).toMatchObject({
                track_id: 67890,
                type: 'track',
                track_name: 'Disliked Track 2',
                artist_name: 'Artist 2',
            });

            // Verify correct query was made
            expect(mockSupabase.from).toHaveBeenCalledWith('dislikes');
            expect(mockSupabase.mockSelect).toHaveBeenCalled();
            expect(mockSupabase.mockEq).toHaveBeenCalledWith('user_id', mockAuthenticatedUser.id);
            expect(mockSupabase.mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
        });

        it('興味なしが0件の場合は空配列を返す', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            mockSupabase.mockOrder.mockResolvedValue({
                data: [],
                error: null,
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.tracks).toEqual([]);
        });

        it('track_pool が null のエントリはフィルタリングされる', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            const mockDataWithNull = [
                {
                    track_id: '12345',
                    created_at: '2024-01-01T00:00:00.000Z',
                    track_pool: [
                        {
                            track_name: 'Valid Track',
                            artist_name: 'Valid Artist',
                            artwork_url: 'https://example.com/artwork.jpg',
                            preview_url: 'https://example.com/preview.mp3',
                        },
                    ],
                },
                {
                    track_id: '67890',
                    created_at: '2024-01-02T00:00:00.000Z',
                    track_pool: null, // Should be filtered out
                },
                {
                    track_id: '99999',
                    created_at: '2024-01-03T00:00:00.000Z',
                    track_pool: [], // Empty array, should be filtered out
                },
            ];

            mockSupabase.mockOrder.mockResolvedValue({
                data: mockDataWithNull,
                error: null,
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.tracks).toHaveLength(1);
            expect(data.tracks[0].track_id).toBe(12345);
        });

        it('created_at の降順でソートされる', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            const mockSortedData = [
                {
                    track_id: '3',
                    created_at: '2024-01-03T00:00:00.000Z',
                    track_pool: [
                        {
                            track_name: 'Latest Track',
                            artist_name: 'Artist 3',
                            artwork_url: 'https://example.com/artwork3.jpg',
                            preview_url: 'https://example.com/preview3.mp3',
                        },
                    ],
                },
                {
                    track_id: '2',
                    created_at: '2024-01-02T00:00:00.000Z',
                    track_pool: [
                        {
                            track_name: 'Middle Track',
                            artist_name: 'Artist 2',
                            artwork_url: 'https://example.com/artwork2.jpg',
                            preview_url: 'https://example.com/preview2.mp3',
                        },
                    ],
                },
                {
                    track_id: '1',
                    created_at: '2024-01-01T00:00:00.000Z',
                    track_pool: [
                        {
                            track_name: 'Oldest Track',
                            artist_name: 'Artist 1',
                            artwork_url: 'https://example.com/artwork1.jpg',
                            preview_url: 'https://example.com/preview1.mp3',
                        },
                    ],
                },
            ];

            mockSupabase.mockOrder.mockResolvedValue({
                data: mockSortedData,
                error: null,
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.tracks[0].track_name).toBe('Latest Track');
            expect(data.tracks[1].track_name).toBe('Middle Track');
            expect(data.tracks[2].track_name).toBe('Oldest Track');
        });
    });

    describe('異常系', () => {
        it('未認証ユーザーは401を返す', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: new Error('Not authenticated'),
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Unauthorized');
        });

        it('認証エラーがある場合は401を返す', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: new Error('Auth token expired'),
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Unauthorized');
        });

        it('データベースエラー時は500を返す', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            mockSupabase.mockOrder.mockResolvedValue({
                data: null,
                error: new Error('Database connection failed'),
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toContain('Failed to fetch dislikes');
        });
    });

    describe('エッジケース', () => {
        it('artwork_url が null でも正常に処理される', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            const mockDataWithNullArtwork = [
                {
                    track_id: '12345',
                    created_at: '2024-01-01T00:00:00.000Z',
                    track_pool: [
                        {
                            track_name: 'Track Without Artwork',
                            artist_name: 'Artist',
                            artwork_url: null, // null artwork
                            preview_url: 'https://example.com/preview.mp3',
                        },
                    ],
                },
            ];

            mockSupabase.mockOrder.mockResolvedValue({
                data: mockDataWithNullArtwork,
                error: null,
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.tracks).toHaveLength(1);
            expect(data.tracks[0].artwork_url).toBeNull();
        });

        it('非常に多数のトラックでも正常に動作する', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            const manyTracks = Array.from({ length: 1000 }, (_, i) => ({
                track_id: String(i + 1),
                created_at: new Date(Date.now() - i * 1000).toISOString(),
                track_pool: [
                    {
                        track_name: `Track ${i + 1}`,
                        artist_name: `Artist ${i + 1}`,
                        artwork_url: `https://example.com/artwork${i + 1}.jpg`,
                        preview_url: `https://example.com/preview${i + 1}.mp3`,
                    },
                ],
            }));

            mockSupabase.mockOrder.mockResolvedValue({
                data: manyTracks,
                error: null,
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.tracks).toHaveLength(1000);
        });
    });
});
