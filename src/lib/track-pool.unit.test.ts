import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTracksFromPool, addTracksToPool, getPoolSize, trimPool } from './track-pool';
import type { Track } from '@/types/track-pool';

// vi.hoistedを使ってモック関数を定義（vi.mock内で使用するため）
const { mockFrom, mockRpc, mockLimit, mockOrder, mockSelect, mockUpsert } = vi.hoisted(() => {
    return {
        mockFrom: vi.fn(),
        mockRpc: vi.fn(),
        mockLimit: vi.fn(),
        mockOrder: vi.fn(),
        mockSelect: vi.fn(),
        mockUpsert: vi.fn()
    };
});

// モジュールモック
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  }
}));

describe('track-pool (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // デフォルトのチェーン設定
    mockFrom.mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
    });

    // select() の戻り値は .order() を持ちつつ、await 可能なオブジェクト (thenを持つ)
    mockSelect.mockReturnValue({
      order: mockOrder,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (onfulfilled: any) => Promise.resolve({ count: 100, error: null }).then(onfulfilled)
    });

    mockOrder.mockReturnValue({
      limit: mockLimit
    });

    // 各メソッドのデフォルト戻り値
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockUpsert.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  describe('getTracksFromPool', () => {
    it('正常にトラックを取得し、型変換を行う', async () => {
      const dbData = [
        {
          track_id: '123', // DBでは数値だが、JSONレスポンス等で文字列として来ることもある想定、あるいはキャストテスト
          track_name: 'Test Song',
          artist_name: 'Test Artist',
          preview_url: 'http://example.com/preview.mp3',
          fetched_at: '2023-01-01T00:00:00Z'
        }
      ];
      mockLimit.mockResolvedValue({ data: dbData, error: null });

      const result = await getTracksFromPool(1);

      expect(mockFrom).toHaveBeenCalledWith('track_pool');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockOrder).toHaveBeenCalledWith('fetched_at', { ascending: true });
      expect(mockLimit).toHaveBeenCalledWith(1);

      expect(result).toHaveLength(1);
      expect(result[0].track_id).toBe(123); // Number変換確認
      expect(result[0].track_name).toBe('Test Song');
    });

    it('無効なtrack_idを除外する', async () => {
      const dbData = [
        { track_id: 'valid_1', track_name: 'Song 1', artist_name: 'Artist 1', preview_url: 'url1' }, // NaNになる
        { track_id: '456', track_name: 'Song 2', artist_name: 'Artist 2', preview_url: 'url2' }
      ];
      mockLimit.mockResolvedValue({ data: dbData, error: null });

      const result = await getTracksFromPool(2);

      // 'valid_1' は Number('valid_1') -> NaN なので除外されるはず
      expect(result).toHaveLength(1);
      expect(result[0].track_id).toBe(456);
    });

    it('DBエラー時に例外をスローする', async () => {
      mockLimit.mockResolvedValue({ data: null, error: { message: 'DB Error' } });

      await expect(getTracksFromPool(1)).rejects.toThrow('Failed to fetch tracks from pool: DB Error');
    });

    it('データがnullの場合は空配列を返す', async () => {
        mockLimit.mockResolvedValue({ data: null, error: null });
        const result = await getTracksFromPool(1);
        expect(result).toEqual([]);
    });
  });

  describe('addTracksToPool', () => {
    const sampleTracks: Track[] = [
      {
        type: 'track',
        track_id: 101,
        track_name: 'New Song',
        artist_name: 'New Artist',
        preview_url: 'http://example.com/new.mp3'
      }
    ];

    it('正常にトラックを追加する', async () => {
      mockUpsert.mockResolvedValue({ error: null });
      // trimPoolも内部で呼ばれるのでRPCのモックも必要
      mockRpc.mockResolvedValue({ data: [], error: null });

      await addTracksToPool(sampleTracks);

      expect(mockFrom).toHaveBeenCalledWith('track_pool');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            track_id: '101', // String変換確認
            track_name: 'New Song'
          })
        ]),
        { onConflict: 'track_id', ignoreDuplicates: false }
      );
    });

    it('トラックが空の場合は何もしない', async () => {
      await addTracksToPool([]);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('Upsertエラー時に例外をスローする', async () => {
      mockUpsert.mockResolvedValue({ error: { message: 'Upsert Error' } });

      await expect(addTracksToPool(sampleTracks)).rejects.toThrow('Failed to add tracks to pool: Upsert Error');
    });
  });

  describe('getPoolSize', () => {
    it('プールサイズを取得する', async () => {
      // select().then(...) が呼ばれる
      mockSelect.mockImplementation(() => ({
          order: mockOrder,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          then: (resolve: any) => resolve({ count: 50, error: null })
      }));

      const size = await getPoolSize();

      expect(mockFrom).toHaveBeenCalledWith('track_pool');
      expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(size).toBe(50);
    });

    it('エラー時に例外をスローする', async () => {
        mockSelect.mockImplementation(() => ({
            order: mockOrder,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            then: (resolve: any) => resolve({ count: null, error: { message: 'Count Error' } })
        }));

      await expect(getPoolSize()).rejects.toThrow('Failed to get pool size: Count Error');
    });
  });

  describe('trimPool', () => {
    it('RPCを呼び出してプールをトリミングする', async () => {
      mockRpc.mockResolvedValue({ data: [{ deleted_count: 5 }], error: null });

      await trimPool(100);

      expect(mockRpc).toHaveBeenCalledWith('trim_track_pool', { max_size: 100 });
    });

    it('RPCの戻り値が文字列形式のdeleted_countの場合も処理する', async () => {
        mockRpc.mockResolvedValue({ data: [{ deleted_count: '15' }], error: null });
        await trimPool(100);
        expect(mockRpc).toHaveBeenCalledWith('trim_track_pool', { max_size: 100 });
     });

    it('RPCエラー時に例外をスローする', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC Error' } });

      await expect(trimPool(100)).rejects.toThrow('Failed to trim track pool: RPC Error');
    });
  });
});
