import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { createMockSupabaseClient, mockAuthenticatedUser } from '@/test/api-test-utils';

// Supabase クライアントをモック
vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
}));

// Rate limiter をモック
vi.mock('@/lib/rateLimiter', () => ({
    rateLimit: vi.fn(() => ({ allowed: true, remaining: 100 })),
}));

// Validation をモック（実際の関数をそのまま使う）
vi.mock('@/lib/validation', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/validation')>();
    return {
        ...actual,
    };
});

const { createClient } = await import('@/lib/supabase/server');
const { rateLimit } = await import('@/lib/rateLimiter');

describe('POST /api/tracks/like', () => {
    let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase = createMockSupabaseClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
        vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 100 });
    });

    describe('正常系', () => {
        it('認証済みユーザーが曲をlikeできる', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            // Mock delete dislike (no existing dislike)
            mockSupabase.mockDelete.mockResolvedValue({ data: null, error: null });

            // Mock upsert like
            mockSupabase.mockUpsert.mockResolvedValue({ data: null, error: null });

            const request = new Request('http://localhost:3000/api/tracks/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_id: '12345' }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);

            // Verify delete was called for dislikes
            expect(mockSupabase.from).toHaveBeenCalledWith('dislikes');
            expect(mockSupabase.mockDelete).toHaveBeenCalled();

            // Verify upsert was called for likes
            expect(mockSupabase.from).toHaveBeenCalledWith('likes');
            expect(mockSupabase.mockUpsert).toHaveBeenCalled();
        });

        it('既存の dislike を削除してから like を追加する', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            mockSupabase.mockDelete.mockResolvedValue({ data: { count: 1 }, error: null });
            mockSupabase.mockUpsert.mockResolvedValue({ data: null, error: null });

            const request = new Request('http://localhost:3000/api/tracks/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_id: 67890 }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);

            // Verify the order: delete dislike first, then upsert like
            const calls = mockSupabase.from.mock.calls;
            expect(calls[0][0]).toBe('dislikes');
            expect(calls[1][0]).toBe('likes');
        });

        it('数値のtrackIdを文字列に正規化する', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            mockSupabase.mockDelete.mockResolvedValue({ data: null, error: null });
            mockSupabase.mockUpsert.mockResolvedValue({ data: null, error: null });

            const request = new Request('http://localhost:3000/api/tracks/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_id: 99999 }), // Number instead of string
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
        });
    });

    describe('異常系', () => {
        it('未認証ユーザーは401を返す', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: null },
                error: new Error('Not authenticated'),
            });

            const request = new Request('http://localhost:3000/api/tracks/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_id: '12345' }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('Unauthorized');
        });

        it('trackIdが欠けている場合は400を返す', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            const request = new Request('http://localhost:3000/api/tracks/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}), // Missing trackId
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain('track_id');
        });

        it('無効なtrackIdの場合は400を返す', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            const request = new Request('http://localhost:3000/api/tracks/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_id: 'invalid' }), // Invalid track ID
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBeDefined();
        });

        it('レート制限に達した場合は429を返す', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            // Mock rate limit exceeded
            vi.mocked(rateLimit).mockReturnValue({ allowed: false, remaining: 0 });

            const request = new Request('http://localhost:3000/api/tracks/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_id: '12345' }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(429);
            expect(data.error).toBe('Too many requests');
        });

        it('dislike削除時のエラーは500を返す', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            // Mock delete error
            mockSupabase.mockDelete.mockResolvedValue({
                data: null,
                error: new Error('Database error'),
            });

            const request = new Request('http://localhost:3000/api/tracks/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_id: '12345' }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toContain('Failed to remove existing dislike');
        });

        it('like追加時のエラーは500を返す', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            mockSupabase.mockDelete.mockResolvedValue({ data: null, error: null });

            // Mock upsert error
            mockSupabase.mockUpsert.mockResolvedValue({
                data: null,
                error: new Error('Database error'),
            });

            const request = new Request('http://localhost:3000/api/tracks/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_id: '12345' }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toContain('Failed to save like');
        });
    });

    describe('エッジケース', () => {
        it('空のボディの場合は400を返す', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            const request = new Request('http://localhost:3000/api/tracks/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBeDefined();
        });

        it('trackIdが0の場合は400を返す', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: { user: mockAuthenticatedUser },
                error: null,
            });

            const request = new Request('http://localhost:3000/api/tracks/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_id: 0 }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBeDefined();
        });
    });
});
