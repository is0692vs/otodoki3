import { validateMetadata, getTracksFromPool, addTracksToPool, getPoolSize } from '../track-pool';
import { supabase } from '../supabase';
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

    afterEach(async () => {
        if (testTrackIds.length === 0) return;
        const { error } = await supabase
            .from('track_pool')
            .delete()
            .in('track_id', testTrackIds);
        if (error) {
            console.error('Cleanup error:', error);
        }
        testTrackIds.length = 0;
    });

    describe('addTracksToPool', () => {
        it('プールに楽曲を追加できる', async () => {
            const tracks: Track[] = [{
                track_id: 'test-001',
                track_name: 'Test Track',
                artist_name: 'Test Artist',
                preview_url: 'https://example.com/preview1.mp3',
            }];
            testTrackIds.push('test-001');

            await addTracksToPool(tracks, { method: 'chart', weight: 1 });
            const size = await getPoolSize();
            expect(size).toBeGreaterThan(0);
        });

        it('重複する楽曲は1件のみ保存される', async () => {
            const tracks: Track[] = [{
                track_id: 'test-002',
                track_name: 'Test Track 2',
                artist_name: 'Test Artist 2',
                preview_url: 'https://example.com/preview2.mp3',
            }];
            testTrackIds.push('test-002');

            await addTracksToPool(tracks, { method: 'chart', weight: 1 });
            await addTracksToPool(tracks, { method: 'chart', weight: 1 });

            const result = await getTracksFromPool(100);
            const duplicates = result.filter(t => t.track_id === 'test-002');
            expect(duplicates).toHaveLength(1);
        });

        it('空配列を追加してもエラーにならない', async () => {
            await expect(addTracksToPool([], { method: 'chart', weight: 1 })).resolves.not.toThrow();
        });
    });

    describe('getTracksFromPool', () => {
        it('指定数の楽曲を取得できる', async () => {
            const tracks: Track[] = Array.from({ length: 5 }, (_, i) => ({
                track_id: `test-${i + 100}`,
                track_name: `Track ${i}`,
                artist_name: `Artist ${i}`,
                preview_url: `https://example.com/preview${i}.mp3`,
            }));
            testTrackIds.push(...tracks.map(t => t.track_id));

            await addTracksToPool(tracks, { method: 'chart', weight: 1 });
            const result = await getTracksFromPool(3);
            expect(result.length).toBeLessThanOrEqual(3);
        });

        it('プールが空の場合は空配列を返す', async () => {
            const result = await getTracksFromPool(10);
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('getPoolSize', () => {
        it('プールサイズを取得できる', async () => {
            const size = await getPoolSize();
            expect(typeof size).toBe('number');
            expect(size).toBeGreaterThanOrEqual(0);
        });
    });
});
