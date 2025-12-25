import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { createMockSupabaseClient, mockAuthenticatedUser } from '@/test/api-test-utils';

// Supabase クライアントをモック
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
}));

const { createClient } = await import('@/lib/supabase/server');

describe('GET /api/playlists', () => {
    let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase = createMockSupabaseClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    });

    describe('正常系', () => {
        it('認証済みユーザーがプレイリスト一覧を取得できる', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            // Mock likes count
            mockSupabase.mockSelect.mockResolvedValueOnce({
                count: 5,
                error: null,
            });

            // Mock dislikes count
            mockSupabase.mockSelect.mockResolvedValueOnce({
                count: 3,
                error: null,
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.playlists).toHaveLength(2);

            // Verify likes playlist
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const likesPlaylist = data.playlists.find((p: any) => p.id === 'likes');
            expect(likesPlaylist).toBeDefined();
            expect(likesPlaylist.name).toBe('お気に入り');
            expect(likesPlaylist.icon).toBe('❤️');
            expect(likesPlaylist.count).toBe(5);

            // Verify dislikes playlist
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dislikesPlaylist = data.playlists.find((p: any) => p.id === 'dislikes');
            expect(dislikesPlaylist).toBeDefined();
            expect(dislikesPlaylist.name).toBe('スキップ済み');
            expect(dislikesPlaylist.icon).toBe('🚫');
            expect(dislikesPlaylist.count).toBe(3);
        });

        it('likes/dislikes が 0 件でも正常に動作する', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            // Mock zero counts
            mockSupabase.mockSelect.mockResolvedValueOnce({
                count: 0,
                error: null,
            });

            mockSupabase.mockSelect.mockResolvedValueOnce({
                count: 0,
                error: null,
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.playlists).toHaveLength(2);
            expect(data.playlists[0].count).toBe(0);
            expect(data.playlists[1].count).toBe(0);
        });

        it('カウント取得エラーでも 0 にフォールバックして動作する', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            // Mock likes count error
            mockSupabase.mockSelect.mockResolvedValueOnce({
                count: null,
                error: new Error('Database error'),
            });

            // Mock dislikes count success
            mockSupabase.mockSelect.mockResolvedValueOnce({
                count: 10,
                error: null,
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.playlists).toHaveLength(2);
            expect(data.playlists[0].count).toBe(0); // Fallback to 0
            expect(data.playlists[1].count).toBe(10);
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
    });

    describe('エッジケース', () => {
        it('count が null の場合は 0 として扱う', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            // Mock null counts
            mockSupabase.mockSelect.mockResolvedValueOnce({
                count: null,
                error: null,
            });

            mockSupabase.mockSelect.mockResolvedValueOnce({
                count: null,
                error: null,
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.playlists[0].count).toBe(0);
            expect(data.playlists[1].count).toBe(0);
        });

        it('非常に大きなカウント値でも正常に動作する', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            // Mock large counts
            mockSupabase.mockSelect.mockResolvedValueOnce({
                count: 999999,
                error: null,
            });

            mockSupabase.mockSelect.mockResolvedValueOnce({
                count: 888888,
                error: null,
            });

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.playlists[0].count).toBe(999999);
            expect(data.playlists[1].count).toBe(888888);
        });
    });
});
