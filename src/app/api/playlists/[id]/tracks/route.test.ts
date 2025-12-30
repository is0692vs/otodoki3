import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { createMockSupabaseClient, mockAuthenticatedUser } from '@/test/api-test-utils';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
}));

const { createClient } = await import('@/lib/supabase/server');

describe('POST /api/playlists/[id]/tracks', () => {
    let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase = createMockSupabaseClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
    });

    it('should add a track successfully', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: mockAuthenticatedUser },
            error: null,
        });

        // verifyPlaylistOwnership
        mockSupabase.mockSingle.mockResolvedValueOnce({
            data: { id: 'playlist-1' },
            error: null,
        });

        // track_pool lookup
        mockSupabase.mockSingle.mockResolvedValueOnce({
            data: {
                track_id: 12345,
                track_name: 'Test Track',
                artist_name: 'Test Artist',
                artwork_url: 'https://example.com/artwork.jpg',
                preview_url: 'https://example.com/preview.mp3',
            },
            error: null,
        });

        // maxPosData (empty playlist)
        mockSupabase.mockMaybeSingle.mockResolvedValueOnce({
            data: null,
            error: null,
        });

        // insert
        mockSupabase.mockInsert.mockResolvedValueOnce({
            error: null,
        });

        const req = new NextRequest('http://localhost/api/playlists/playlist-1/tracks', {
            method: 'POST',
            body: JSON.stringify({ track_id: '12345' }),
        });

        const params = Promise.resolve({ id: 'playlist-1' });
        const response = await POST(req, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
    });

    it('should handle unique constraint violation (409)', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: mockAuthenticatedUser },
            error: null,
        });

        // verifyPlaylistOwnership
        mockSupabase.mockSingle.mockResolvedValueOnce({
            data: { id: 'playlist-1' },
            error: null,
        });

        // maxPosData
        mockSupabase.mockMaybeSingle.mockResolvedValueOnce({
            data: { position: 1 },
            error: null,
        });

        // insert error (23505)
        mockSupabase.mockInsert.mockResolvedValueOnce({
            error: { code: '23505', message: 'Unique violation' },
        });

        const req = new NextRequest('http://localhost/api/playlists/playlist-1/tracks', {
            method: 'POST',
            body: JSON.stringify({ track_id: '12345' }),
        });

        const params = Promise.resolve({ id: 'playlist-1' });
        const response = await POST(req, { params });
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toBe('Track already in playlist');
    });
});
