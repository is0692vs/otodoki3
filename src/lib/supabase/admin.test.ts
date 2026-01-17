import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAdminClient } from './admin';

const { createClientMock } = vi.hoisted(() => ({
    createClientMock: vi.fn()
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: createClientMock
}));

describe('admin client', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        createClientMock.mockClear();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('環境変数が設定されている場合、Service Role Keyでクライアントを作成する', () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

        createAdminClient();

        expect(createClientMock).toHaveBeenCalledWith(
            'http://localhost',
            'service-role-key',
            expect.objectContaining({
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            })
        );
    });

    it('URLが不足している場合はエラーをスローする', () => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';
        expect(() => createAdminClient()).toThrow('Missing required env var: NEXT_PUBLIC_SUPABASE_URL');
    });

    it('Service Role Keyが不足している場合はエラーをスローする', () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'url';
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        expect(() => createAdminClient()).toThrow('Missing required env var: SUPABASE_SERVICE_ROLE_KEY');
    });
});
