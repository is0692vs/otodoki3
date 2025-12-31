import { vi } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MockSupabaseClient = Partial<SupabaseClient<any, "public", any>> & {
    mockSelect: ReturnType<typeof vi.fn>;
    mockInsert: ReturnType<typeof vi.fn>;
    mockUpdate: ReturnType<typeof vi.fn>;
    mockDelete: ReturnType<typeof vi.fn>;
    mockUpsert: ReturnType<typeof vi.fn>;
    mockOrder: ReturnType<typeof vi.fn>;
    mockLimit: ReturnType<typeof vi.fn>;
    mockSingle: ReturnType<typeof vi.fn>;
    mockMaybeSingle: ReturnType<typeof vi.fn>;
    mockEq: ReturnType<typeof vi.fn>;
    mockGt: ReturnType<typeof vi.fn>;
    mockLt: ReturnType<typeof vi.fn>;
    mockGte: ReturnType<typeof vi.fn>;
    mockLte: ReturnType<typeof vi.fn>;
    mockIn: ReturnType<typeof vi.fn>;
    mockNot: ReturnType<typeof vi.fn>;
    mockNeq: ReturnType<typeof vi.fn>;
    mockIs: ReturnType<typeof vi.fn>;
    mockOr: ReturnType<typeof vi.fn>;
    mockAnd: ReturnType<typeof vi.fn>;
    mockRpc: ReturnType<typeof vi.fn>;
    auth: {
        getUser: ReturnType<typeof vi.fn>;
    };
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
};

/**
 * Supabase クライアントのモックを作成するヘルパー
 */
export function createMockSupabaseClient(): MockSupabaseClient {
    const mockSelect = vi.fn();
    const mockInsert = vi.fn();
    const mockUpdate = vi.fn();
    const mockDelete = vi.fn();
    const mockUpsert = vi.fn();
    const mockOrder = vi.fn();
    const mockLimit = vi.fn();
    const mockSingle = vi.fn();
    const mockMaybeSingle = vi.fn();
    const mockEq = vi.fn();
    const mockGt = vi.fn();
    const mockLt = vi.fn();
    const mockGte = vi.fn();
    const mockLte = vi.fn();
    const mockIn = vi.fn();
    const mockNot = vi.fn();
    const mockNeq = vi.fn();
    const mockIs = vi.fn();
    const mockOr = vi.fn();
    const mockAnd = vi.fn();
    const mockRpc = vi.fn();

    // クエリビルダー（await 可能なモック）を生成
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createQueryBuilder = (): any => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const builder: any = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            _pending: undefined as Promise<any> | any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            _resolveWith: undefined as ((...args: any[]) => any) | undefined,
        };

        // DB から結果を返す系（await 時にこの結果を返す）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resultMethods: Record<string, (...args: any[]) => any> = {
            select: mockSelect,
            insert: mockInsert,
            update: mockUpdate,
            delete: mockDelete,
            upsert: mockUpsert,
            order: mockOrder,
            limit: mockLimit,
            single: mockSingle,
            maybeSingle: mockMaybeSingle,
        };

        // フィルタリングだけ行う系（結果は変えずにチェーン継続）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chainOnlyMethods: Record<string, (...args: any[]) => any> = {
            eq: mockEq,
            gt: mockGt,
            lt: mockLt,
            gte: mockGte,
            lte: mockLte,
            in: mockIn,
            not: mockNot,
            neq: mockNeq,
            is: mockIs,
            or: mockOr,
            and: mockAnd,
        };

        Object.entries(resultMethods).forEach(([name, mock]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            builder[name] = (...args: any[]) => {
                builder._resolveWith = mock;
                builder._pending = mock(...args);
                return builder;
            };
        });

        Object.entries(chainOnlyMethods).forEach(([name, mock]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            builder[name] = (...args: any[]) => {
                mock(...args);
                return builder;
            };
        });

        Object.defineProperty(builder, 'then', {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            value: (onFulfilled?: any, onRejected?: any) => {
                const pending = builder._pending ?? Promise.resolve({ data: null, error: null });
                return Promise.resolve(pending).then(onFulfilled, onRejected);
            },
            writable: true,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        builder.catch = (onRejected?: any) => builder.then(undefined, onRejected);

        return builder;
    };

    // from() を呼ぶたびに新しいクエリビルダーを返す
    const fromMock = vi.fn(() => createQueryBuilder());

    return {
        auth: {
            getUser: vi.fn(),
        },
        from: fromMock,
        rpc: mockRpc,
        // テストで結果を差し込むために公開
        mockSelect,
        mockInsert,
        mockUpdate,
        mockDelete,
        mockUpsert,
        mockOrder,
        mockLimit,
        mockSingle,
        mockMaybeSingle,
        mockEq,
        mockGt,
        mockLt,
        mockGte,
        mockLte,
        mockIn,
        mockNot,
        mockNeq,
        mockIs,
        mockOr,
        mockAnd,
        mockRpc,
    };
}

/**
 * 認証済みユーザーのモックデータ
 */
export const mockAuthenticatedUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    created_at: '2024-01-01T00:00:00.000Z',
};

/**
 * NextRequest のモックを作成するヘルパー
 */
export function createMockNextRequest(url: string, options?: RequestInit) {
    return {
        url,
        method: options?.method || 'GET',
        headers: new Headers(options?.headers),
        json: async () => (options?.body ? JSON.parse(options.body as string) : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
}

/**
 * モックトラックデータ
 */
export const mockTrackData = {
    track_id: '12345',
    track_name: 'Test Track',
    artist_name: 'Test Artist',
    artwork_url: 'https://example.com/artwork.jpg',
    preview_url: 'https://example.com/preview.mp3',
    type: 'track' as const,
};

/**
 * モックトラックプールデータ
 */
export const mockTrackPoolData = [
    {
        track_id: '12345',
        track_name: 'Test Track 1',
        artist_name: 'Test Artist 1',
        artwork_url: 'https://example.com/artwork1.jpg',
        preview_url: 'https://example.com/preview1.mp3',
    },
    {
        track_id: '67890',
        track_name: 'Test Track 2',
        artist_name: 'Test Artist 2',
        artwork_url: 'https://example.com/artwork2.jpg',
        preview_url: 'https://example.com/preview2.mp3',
    },
];
