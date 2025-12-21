import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// 環境変数を優先的に参照（テスト用に PROCESS env の別名も許容）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

// テスト実行時や環境変数が無い場合でも、モジュールのインポート時に例外を投げないように安全なフォールバックを使う
const supabase = (() => {
    try {
        if (!supabaseUrl || !supabaseAnonKey) {
            if (process.env.NODE_ENV === 'test') {
                console.warn('Supabase env vars not found; attempting to create client with dummy values for tests.');
                try {
                    return createClient<Database>('http://127.0.0.1', 'anon');
                } catch (e) {
                    console.warn('Failed to create Supabase client with dummy values, falling back to stub client.', e);
                }
            }

            // 環境が整っていない場合は、インポート時に例外を投げない「スタブ」クライアントを返す
            const stub = {
                from: () => stub, // chainable
                select: async () => ({ data: null, error: null }),
                order: () => stub,
                limit: () => ({ data: null, error: null }),
                upsert: async () => ({ error: null }),
                delete: async () => ({ error: null }),
                rpc: () => ({ maybeSingle: async () => ({ data: null, error: { code: 'PGRST202', message: 'function not found' } }) }),
            } as unknown as ReturnType<typeof createClient>;

            return stub;
        }

        return createClient<Database>(supabaseUrl, supabaseAnonKey);
    } catch (e) {
        console.warn('Failed to create Supabase client, using stub client instead.', e);
        const stub = {
            from: () => stub,
            select: async () => ({ data: null, error: null }),
            order: () => stub,
            limit: () => ({ data: null, error: null }),
            upsert: async () => ({ error: null }),
            delete: async () => ({ error: null }),
            rpc: () => ({ maybeSingle: async () => ({ data: null, error: { code: 'PGRST202', message: 'function not found' } }) }),
        } as unknown as ReturnType<typeof createClient>;

        return stub;
    }
})();

export { supabase };