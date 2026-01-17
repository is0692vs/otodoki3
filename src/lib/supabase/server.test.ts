import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from './server';

const { createServerClientMock, cookiesMock } = vi.hoisted(() => ({
    createServerClientMock: vi.fn(),
    cookiesMock: vi.fn()
}));

vi.mock('@supabase/ssr', () => ({
    createServerClient: createServerClientMock
}));

vi.mock('next/headers', () => ({
    cookies: cookiesMock
}));

describe('server client', () => {
     const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

        cookiesMock.mockResolvedValue({
            getAll: vi.fn(() => []),
            set: vi.fn()
        });
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('サーバークライアントを作成する', async () => {
        await createClient();
        expect(cookiesMock).toHaveBeenCalled();
        expect(createServerClientMock).toHaveBeenCalledWith(
            'http://localhost',
            'anon-key',
            expect.any(Object)
        );
    });

    it('環境変数が不足している場合はエラーをスローする', async () => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        await expect(createClient()).rejects.toThrow('Missing required env vars');
    });
});
