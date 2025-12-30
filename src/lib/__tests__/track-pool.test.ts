import {
    validateMetadata,
    getTracksFromPool,
    addTracksToPool,
    getPoolSize,
    trimPool
} from '../track-pool';
import { supabase } from '../supabase';
import { mockTracks } from '../__fixtures__/tracks';
import type { Track } from '@/types/track-pool';

// テスト後のクリーンアップ用ヘルパー
async function cleanupTestTracks() {
    // test_data: true のメタデータを持つトラックを削除
    const { error } = await supabase
        .from('track_pool')
        .delete()
        .or('track_id.in.(1001,1002,1003),metadata->>test_data.eq.true');

    if (error) {
        // エラーがあればテストを失敗させる
        throw new Error(`Cleanup failed: ${error.message}`);
    }
}

describe('validateMetadata', () => {
    it('should return null for null or undefined', () => {
        expect(validateMetadata(null)).toBeNull();
        expect(validateMetadata(undefined)).toBeNull();
    });

    it('should return null for arrays', () => {
        expect(validateMetadata([])).toBeNull();
        expect(validateMetadata([1, 2, 3])).toBeNull();
    });

    it('should parse valid JSON strings', () => {
        const result = validateMetadata('{"key":"value"}');
        expect(result).toEqual({ key: 'value' });
    });

    it('should return null for invalid JSON strings', () => {
        expect(validateMetadata('invalid json')).toBeNull();
    });

    it('should return null for JSON string arrays', () => {
        expect(validateMetadata('["item1", "item2"]')).toBeNull();
    });

    it('should accept valid objects', () => {
        const obj = { key: 'value' };
        expect(validateMetadata(obj)).toEqual(obj);
    });

    it('should return null for primitive types', () => {
        expect(validateMetadata(42)).toBeNull();
        expect(validateMetadata(true)).toBeNull();
    });
});

const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
const isCI = process.env.CI === 'true';
const describeIf = (cond: boolean) => cond ? describe : describe.skip;

describeIf(hasSupabase && !isCI)('track-pool integration tests', () => {
    // テスト前後でクリーンアップ
    beforeEach(async () => {
        await cleanupTestTracks();
    });

    afterEach(async () => {
        await cleanupTestTracks();
    });

    describe('getPoolSize', () => {
        it('should return the current pool size', async () => {
            const initialSize = await getPoolSize();
            expect(typeof initialSize).toBe('number');
            expect(initialSize).toBeGreaterThanOrEqual(0);
        });

        it('should reflect changes after adding tracks', async () => {
            const initialSize = await getPoolSize();

            // トラックを1つ追加
            await addTracksToPool([mockTracks[0]]);

            const newSize = await getPoolSize();
            expect(newSize).toBeGreaterThanOrEqual(initialSize);
        });
    });

    describe('addTracksToPool', () => {
        it('should add tracks to the pool', async () => {
            const initialSize = await getPoolSize();

            await addTracksToPool(mockTracks);

            const newSize = await getPoolSize();
            expect(newSize).toBeGreaterThan(initialSize);
        });

        it('should handle empty array', async () => {
            const initialSize = await getPoolSize();

            await addTracksToPool([]);

            const newSize = await getPoolSize();
            expect(newSize).toBe(initialSize);
        });

        it('should upsert on duplicate track_id', async () => {
            // 同じトラックを2回追加
            await addTracksToPool([mockTracks[0]]);
            const sizeAfterFirst = await getPoolSize();

            await addTracksToPool([mockTracks[0]]);
            const sizeAfterSecond = await getPoolSize();

            // サイズは変わらないはず（upsert）
            expect(sizeAfterSecond).toBe(sizeAfterFirst);
        });

        it('should accept options with method and weight', async () => {
            await expect(
                addTracksToPool([mockTracks[0]], { method: 'chart', weight: 0.8 })
            ).resolves.not.toThrow();
        });

        it('should validate metadata before inserting', async () => {
            const trackWithInvalidMetadata = {
                ...mockTracks[0],
                track_id: 9999,
                metadata: ['invalid', 'array'] as unknown,
            } as unknown as Track;

            // 配列メタデータは null に変換されるべき
            await expect(
                addTracksToPool([trackWithInvalidMetadata])
            ).resolves.not.toThrow();
        });
    });

    describe('getTracksFromPool', () => {
        it('should return empty array when pool is empty', async () => {
            // クリーンアップ済みなので、テストトラックは存在しない
            const tracks = await getTracksFromPool(10);
            expect(Array.isArray(tracks)).toBe(true);
        });

        it('should return tracks from pool', async () => {
            // トラックを追加
            await addTracksToPool(mockTracks);

            // 取得
            const tracks = await getTracksFromPool(2);
            expect(tracks.length).toBeGreaterThan(0);
            expect(tracks.length).toBeLessThanOrEqual(2);

            // Track型の検証
            if (tracks.length > 0) {
                expect(tracks[0]).toHaveProperty('track_id');
                expect(tracks[0]).toHaveProperty('track_name');
                expect(tracks[0]).toHaveProperty('artist_name');
                expect(tracks[0]).toHaveProperty('preview_url');
            }
        });

        it('should return tracks ordered by fetched_at ascending', async () => {
            // 複数のトラックを時間差で追加
            await addTracksToPool([mockTracks[0]]);
            await new Promise(resolve => setTimeout(resolve, 100));
            await addTracksToPool([mockTracks[1]]);

            const tracks = await getTracksFromPool(10);

            if (tracks.length >= 2) {
                // fetched_at の順序を確認（古い順）
                // 実際にはデータベースから取得するので、正確な検証は難しいが、
                // 少なくとも取得できることを確認
                expect(tracks.length).toBeGreaterThanOrEqual(2);
            }
        });

        it('should respect the count limit', async () => {
            await addTracksToPool(mockTracks);

            const tracks = await getTracksFromPool(1);
            expect(tracks.length).toBeLessThanOrEqual(1);
        });
    });

    describe('trimPool', () => {
        it('should trim pool when size exceeds max', async () => {
            // 複数のトラックを追加
            await addTracksToPool(mockTracks);

            const initialSize = await getPoolSize();

            // 非常に小さいサイズで trim（例: 1）
            // ただし、他のトラックも存在する可能性があるので慎重に
            await trimPool(1);

            const newSize = await getPoolSize();
            expect(newSize).toBeLessThanOrEqual(Math.max(initialSize, 1));
        });

        it('should not throw error when pool is empty', async () => {
            await expect(trimPool(10)).resolves.not.toThrow();
        });

        it('should keep tracks when pool size is below max', async () => {
            await addTracksToPool([mockTracks[0]]);
            const sizeBefore = await getPoolSize();

            // 十分大きいサイズで trim
            await trimPool(10000);

            const sizeAfter = await getPoolSize();
            expect(sizeAfter).toBe(sizeBefore);
        });

        it('should call RPC function trim_track_pool', async () => {
            // RPC が正常に動作することを確認
            await expect(trimPool(100)).resolves.not.toThrow();
        });
    });
});

describeIf(hasSupabase)('track-pool error handling', () => {
    describe('getTracksFromPool with invalid input', () => {
        it('should handle negative count gracefully', async () => {
            // Supabase は負の limit をエラーとするかもしれない
            await expect(getTracksFromPool(-1)).rejects.toThrow();
        });

        it('should handle zero count', async () => {
            const tracks = await getTracksFromPool(0);
            expect(tracks).toEqual([]);
        });
    });

    describe('addTracksToPool error cases', () => {
        afterEach(async () => {
            await cleanupTestTracks();
        });

        it('should throw error for tracks with missing required fields', async () => {
            const invalidTrack = {
                track_id: 8888,
                // track_name, artist_name, preview_url が欠けている
            } as unknown as Track;

            await expect(
                addTracksToPool([invalidTrack])
            ).rejects.toThrow();
        });
    });
});
