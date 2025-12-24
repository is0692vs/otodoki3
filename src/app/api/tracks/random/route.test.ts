import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { createMockSupabaseClient, mockAuthenticatedUser, mockTrackPoolData } from '@/test/api-test-utils';

// Supabase クライアントをモック
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
}));

const { createClient } = await import('@/lib/supabase/server');

describe('GET /api/tracks/random', () => {
    let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase = createMockSupabaseClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    });

    describe('正常系', () => {
        it('認証済みユーザーがランダムなトラックを取得できる', async () => {
            // Mock authenticated user
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            // Mock empty dislikes and likes (no filtering)
            mockSupabase.mockSelect.mockResolvedValueOnce({ data: [], error: null }); // dislikes
            mockSupabase.mockSelect.mockResolvedValueOnce({ data: [], error: null }); // likes

            // Mock track pool data
            mockSupabase.mockLimit.mockResolvedValue({
                data: mockTrackPoolData,
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/tracks/random?count=2');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.tracks).toHaveLength(2);
            expect(data.tracks[0]).toHaveProperty('track_id');
            expect(data.tracks[0]).toHaveProperty('track_name');
            expect(data.tracks[0]).toHaveProperty('artist_name');
        });

        it('未認証ユーザーもトラックを取得できる', async () => {
            // Mock unauthenticated user
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: new Error('Not authenticated'),
            });

            // Mock track pool data (no filtering for unauthenticated users)
            mockSupabase.mockLimit.mockResolvedValue({
                data: mockTrackPoolData,
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/tracks/random');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.tracks).toBeDefined();
            expect(Array.isArray(data.tracks)).toBe(true);
        });

        it('count パラメータを指定してトラック数を制御できる', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            const manyTracks = Array.from({ length: 50 }, (_, i) => ({
                track_id: String(i + 1),
                track_name: `Track ${i + 1}`,
                artist_name: `Artist ${i + 1}`,
                artwork_url: `https://example.com/artwork${i + 1}.jpg`,
                preview_url: `https://example.com/preview${i + 1}.mp3`,
            }));

            mockSupabase.mockLimit.mockResolvedValue({
                data: manyTracks,
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/tracks/random?count=25');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.tracks).toHaveLength(25);
        });

        it('count が範囲外の場合は適切に制限される（最小1、最大100）', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            mockSupabase.mockLimit.mockResolvedValue({
                data: mockTrackPoolData,
                error: null,
            });

            // Test count=0 (should default to 1)
            const request1 = new NextRequest('http://localhost:3000/api/tracks/random?count=0');
            const response1 = await GET(request1);
            const data1 = await response1.json();
            expect(data1.tracks).toHaveLength(Math.min(1, mockTrackPoolData.length));

            // Test count=200 (should be capped at 100, but we only have 2 tracks in mock)
            const request2 = new NextRequest('http://localhost:3000/api/tracks/random?count=200');
            const response2 = await GET(request2);
            const data2 = await response2.json();
            expect(data2.tracks).toHaveLength(mockTrackPoolData.length);
        });

        it('認証済みユーザーの場合、dislike/like 履歴に基づいてフィルタリングされる', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            // Mock dislikes and likes
            mockSupabase.mockSelect.mockResolvedValueOnce({
                data: [{ track_id: 12345 }],
                error: null,
            }); // dislikes
            mockSupabase.mockSelect.mockResolvedValueOnce({
                data: [{ track_id: 67890 }],
                error: null,
            }); // likes

            // Mock track pool data (should exclude 12345 and 67890)
            const filteredTracks = [
                {
                    track_id: '99999',
                    track_name: 'New Track',
                    artist_name: 'New Artist',
                    artwork_url: 'https://example.com/artwork.jpg',
                    preview_url: 'https://example.com/preview.mp3',
                },
            ];

            mockSupabase.mockLimit.mockResolvedValue({
                data: filteredTracks,
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/tracks/random?count=10');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.tracks).toBeDefined();
            // Verify that the .not() method was called to exclude tracks
            expect(mockSupabase.mockNot).toHaveBeenCalledWith(
                'track_id',
                'in',
                expect.stringContaining('(')
            );
        });
    });

    describe('異常系', () => {
        it('トラックプールが空の場合は 404 を返す', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            mockSupabase.mockLimit.mockResolvedValue({
                data: [],
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/tracks/random');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.error).toContain('No tracks available');
        });

        it('データベースエラー時は 500 を返す', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            mockSupabase.mockLimit.mockResolvedValue({
                data: null,
                error: new Error('Database connection failed'),
            });

            const request = new NextRequest('http://localhost:3000/api/tracks/random');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.error).toContain('Failed to fetch tracks');
        });
    });

    describe('エッジケース', () => {
        it('count パラメータが不正な値の場合はデフォルト10を使用', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            const manyTracks = Array.from({ length: 20 }, (_, i) => ({
                track_id: String(i + 1),
                track_name: `Track ${i + 1}`,
                artist_name: `Artist ${i + 1}`,
                artwork_url: `https://example.com/artwork${i + 1}.jpg`,
                preview_url: `https://example.com/preview${i + 1}.mp3`,
            }));

            mockSupabase.mockLimit.mockResolvedValue({
                data: manyTracks,
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/tracks/random?count=invalid');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.tracks).toHaveLength(10); // Default count
        });

        it('除外トラック数が多い場合でも正常に動作する', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            // Mock 1500 dislikes (exceeds MAX_EXCLUDE of 1000)
            const manyDislikes = Array.from({ length: 1500 }, (_, i) => ({
                track_id: i + 1,
            }));

            mockSupabase.mockSelect.mockResolvedValueOnce({
                data: manyDislikes,
                error: null,
            }); // dislikes
            mockSupabase.mockSelect.mockResolvedValueOnce({
                data: [],
                error: null,
            }); // likes

            mockSupabase.mockLimit.mockResolvedValue({
                data: mockTrackPoolData,
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/tracks/random?count=5');
            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            // Should handle large exclude list by truncating
        });
    });
});
