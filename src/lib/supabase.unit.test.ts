import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// モックを定義
const createClientMock = vi.fn(() => ({
    realClient: true
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: createClientMock
}));

describe('supabase module', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('環境変数が設定されている場合、正常にクライアントを作成する', async () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.com';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'valid-key';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { supabase } = await import('./supabase') as any;

        expect(createClientMock).toHaveBeenCalledWith('https://example.com', 'valid-key');
        expect(supabase.realClient).toBe(true);
    });

    it('環境変数が不足しており、かつテスト環境でない場合、スタブを使用する', async () => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.SUPABASE_URL;
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        delete process.env.SUPABASE_ANON_KEY;

        // テスト環境以外をシミュレート
        const originalNodeEnv = process.env.NODE_ENV;
        Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });

        try {
            const { supabase } = await import('./supabase');

            // createClientは呼ばれないはず
            expect(createClientMock).not.toHaveBeenCalled();

            // スタブの動作確認
            expect(await supabase.from('test').select()).toEqual({ data: null, error: null });
            expect(await supabase.rpc('test').maybeSingle()).toEqual({ data: null, error: { code: 'PGRST202', message: 'function not found' } });
        } finally {
            Object.defineProperty(process.env, 'NODE_ENV', { value: originalNodeEnv, configurable: true });
        }
    });

    it('環境変数が不足していても、テスト環境であればダミークライアント作成を試みる', async () => {
         delete process.env.NEXT_PUBLIC_SUPABASE_URL;
         delete process.env.SUPABASE_URL;

         // NODE_ENV is 'test' by default in vitest
         await import('./supabase');

         // ダミー値で呼ばれる
         expect(createClientMock).toHaveBeenCalledWith('http://127.0.0.1', 'anon');
    });
});
