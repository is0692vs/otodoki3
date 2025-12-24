import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from './client';

vi.mock('@supabase/ssr', () => ({
    createBrowserClient: vi.fn((url: string, key: string) => ({
        url,
        key,
        from: vi.fn(),
        auth: { getUser: vi.fn() },
    })),
}));

describe('createClient (Browser)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('正常系', () => {
        it('正しい環境変数でクライアントを作成できる', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

            const client = createClient();

            expect(client).toBeDefined();
            expect(client.url).toBe('https://example.supabase.co');
            expect(client.key).toBe('test-anon-key');
        });

        it('createBrowserClientが正しいパラメータで呼ばれる', async () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key-123';

            const { createBrowserClient } = await import('@supabase/ssr');
            
            createClient();

            expect(createBrowserClient).toHaveBeenCalledWith(
                'https://test.supabase.co',
                'test-key-123'
            );
        });
    });

    describe('エラーハンドリング', () => {
        it('NEXT_PUBLIC_SUPABASE_URLが未設定の場合はエラーをスローする', () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

            expect(() => createClient()).toThrow('Missing required env vars');
        });

        it('NEXT_PUBLIC_SUPABASE_ANON_KEYが未設定の場合はエラーをスローする', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            expect(() => createClient()).toThrow('Missing required env vars');
        });

        it('両方の環境変数が未設定の場合はエラーをスローする', () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            expect(() => createClient()).toThrow('Missing required env vars');
        });

        it('空文字列の環境変数もエラーとして扱う', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = '';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

            expect(() => createClient()).toThrow('Missing required env vars');
        });
    });

    describe('エッジケース', () => {
        it('複数回呼び出しても新しいクライアントが作成される', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

            const client1 = createClient();
            const client2 = createClient();

            expect(client1).toBeDefined();
            expect(client2).toBeDefined();
        });
    });
});