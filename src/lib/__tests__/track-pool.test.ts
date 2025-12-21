import { validateMetadata, getTracksFromPool, addTracksToPool, getPoolSize } from '../track-pool';
import { cleanupTestData } from '@/tests/setup';
import type { Track } from '@/types/track-pool';

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

describe('track-pool', () => {
    const testTrackIds: string[] = [];
    const hasSupabaseCredentials = process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://localhost:54321' &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'test-key';

    // Skip integration tests if Supabase credentials are not available
    const describeIfSupabase = hasSupabaseCredentials ? describe : describe.skip;

    afterEach(async () => {
        if (hasSupabaseCredentials) {
            await cleanupTestData(testTrackIds);
        }
    });

    describeIfSupabase('addTracksToPool', () => {
        it('プールに楽曲を追加できる', async () => {
            const tracks: Track[] = [{
                track_id: '999000001',
                track_name: 'Test Track',
                artist_name: 'Test Artist',
                preview_url: 'https://example.com/preview1.mp3',
            }];
            testTrackIds.push('999000001');

            await addTracksToPool(tracks, { method: 'chart', weight: 1 });
            const size = await getPoolSize();
            expect(size).toBeGreaterThan(0);
        });

        it('重複する楽曲は1件のみ保存される', async () => {
            const tracks: Track[] = [{
                track_id: '999000002',
                track_name: 'Test Track 2',
                artist_name: 'Test Artist 2',
                preview_url: 'https://example.com/preview2.mp3',
            }];
            testTrackIds.push('999000002');

            // 1回目の追加
            await addTracksToPool(tracks, { method: 'chart', weight: 1 });
            const sizeAfterFirst = await getPoolSize();
            
            // 2回目の追加（重複）
            await addTracksToPool(tracks, { method: 'chart', weight: 1 });
            const sizeAfterSecond = await getPoolSize();
            
            // サイズが変わらないことを確認（重複が排除されている）
            expect(sizeAfterSecond).toBe(sizeAfterFirst);
        });

        it('空配列を追加してもエラーにならない', async () => {
            await expect(addTracksToPool([], { method: 'chart', weight: 1 })).resolves.not.toThrow();
        });
    });

    describeIfSupabase('getTracksFromPool', () => {
        it('指定数の楽曲を取得できる', async () => {
            const tracks: Track[] = Array.from({ length: 5 }, (_, i) => ({
                track_id: `999${String(i + 100).padStart(6, '0')}`,
                track_name: `Track ${i}`,
                artist_name: `Artist ${i}`,
                preview_url: `https://example.com/preview${i}.mp3`,
            }));
            testTrackIds.push(...tracks.map(t => t.track_id));

            await addTracksToPool(tracks, { method: 'chart', weight: 1 });
            const result = await getTracksFromPool(3);
            expect(result.length).toBe(3);
        });

        it('プールが空の場合は空配列を返す', async () => {
            const result = await getTracksFromPool(10);
            expect(result).toEqual([]);
        });
    });

    describeIfSupabase('getPoolSize', () => {
        it('プールサイズを取得できる', async () => {
            const size = await getPoolSize();
            expect(typeof size).toBe('number');
            expect(size).toBeGreaterThanOrEqual(0);
        });
    });
});
