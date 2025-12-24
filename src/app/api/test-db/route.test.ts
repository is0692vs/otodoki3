import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/supabase', () => ({
    supabase: {
        rpc: vi.fn(),
    },
}));

describe('GET /api/test-db', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('正常系', () => {
        it('データベース接続が成功した場合、正常なレスポンスを返す', async () => {
            const { supabase } = await import('@/lib/supabase');
            
            vi.mocked(supabase.rpc).mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: '2024-01-01T00:00:00Z',
                    error: null,
                }),
            } as any);

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toMatchObject({
                status: 'connected',
                message: 'Supabase connection successful',
                serverTime: '2024-01-01T00:00:00Z',
            });
        });

        it('RPC関数が存在しない場合でも接続確認として扱う', async () => {
            const { supabase } = await import('@/lib/supabase');
            
            vi.mocked(supabase.rpc).mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: {
                        code: 'PGRST202',
                        message: 'function not found',
                    },
                }),
            } as any);

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toMatchObject({
                status: 'connected',
                message: 'Supabase connection OK (no RPC defined)',
            });
        });
    });

    describe('エラーハンドリング', () => {
        it('データベースエラーが発生した場合、500エラーを返す', async () => {
            const { supabase } = await import('@/lib/supabase');
            
            vi.mocked(supabase.rpc).mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: {
                        code: 'PGRST301',
                        message: 'Connection error',
                    },
                }),
            } as any);

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data).toMatchObject({
                status: 'error',
            });

            consoleErrorSpy.mockRestore();
        });

        it('予期しない例外が発生した場合、500エラーを返す', async () => {
            const { supabase } = await import('@/lib/supabase');
            
            vi.mocked(supabase.rpc).mockImplementation(() => {
                throw new Error('Unexpected error');
            });

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data).toMatchObject({
                status: 'error',
                message: 'Unexpected error',
            });

            consoleErrorSpy.mockRestore();
        });

        it('非Errorオブジェクトの例外でもエラーレスポンスを返す', async () => {
            const { supabase } = await import('@/lib/supabase');
            
            vi.mocked(supabase.rpc).mockImplementation(() => {
                throw 'String error';
            });

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data).toMatchObject({
                status: 'error',
                message: 'An internal server error occurred.',
            });

            consoleErrorSpy.mockRestore();
        });
    });

    describe('エッジケース', () => {
        it('dataがnullでerrorもnullの場合を処理できる', async () => {
            const { supabase } = await import('@/lib/supabase');
            
            vi.mocked(supabase.rpc).mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            } as any);

            const response = await GET();
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.status).toBe('connected');
        });

        it('様々なエラーコードを正しく処理する', async () => {
            const { supabase } = await import('@/lib/supabase');
            const errorCodes = ['PGRST000', 'PGRST116', 'PGRST200'];

            for (const code of errorCodes) {
                vi.mocked(supabase.rpc).mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                        data: null,
                        error: {
                            code,
                            message: `Error with code ${code}`,
                        },
                    }),
                } as any);

                const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

                const response = await GET();
                const data = await response.json();

                if (code !== 'PGRST202') {
                    expect(response.status).toBe(500);
                    expect(data.status).toBe('error');
                }

                consoleErrorSpy.mockRestore();
            }
        });
    });
});