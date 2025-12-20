/**
 * 楽曲プール管理機能のテストスクリプト
 * 
 * 使用方法:
 * node --loader ts-node/esm test-track-pool.ts
 */

import {
    getTracksFromPool,
    addTracksToPool,
    getPoolSize,
} from '@/lib/track-pool';
import { fetchTracksFromChart } from '@/lib/refill-methods/chart';
import { supabase } from '@/lib/supabase';

async function main() {
    console.log('=== 楽曲プール管理機能のテスト ===\n');

    // キャプチャしてテスト後にクリーンアップできるようにする
    let addedTrackIds: string[] = [];

    try {
        // 1. 現在のプールサイズを確認
        console.log('1. 現在のプールサイズを確認中...');
        const initialSize = await getPoolSize();
        console.log(`現在のプールサイズ: ${initialSize}曲\n`);

        // 2. チャートから楽曲を取得
        console.log('2. チャート楽曲を取得中...');
        const tracks = await fetchTracksFromChart(10);
        console.log(`取得した楽曲数: ${tracks.length}曲\n`);

        if (tracks.length > 0) {
            console.log('取得した楽曲の例:');
            console.log(`- ${tracks[0].track_name} by ${tracks[0].artist_name}\n`);
        }

        // 3. プールに楽曲を追加
        console.log('3. プールに楽曲を追加中...');
        await addTracksToPool(tracks, { method: 'chart', weight: 1.0 });
        // 追加した track_id を保存してクリーンアップに使う
        addedTrackIds = tracks.map((t) => t.track_id);
        console.log('楽曲の追加が完了しました\n');

        // 4. 追加後のプールサイズを確認
        console.log('4. 追加後のプールサイズを確認中...');
        const finalSize = await getPoolSize();
        console.log(`追加後のプールサイズ: ${finalSize}曲\n`);

        // 5. プールから楽曲を取得
        console.log('5. プールから楽曲を取得中...');
        const poolTracks = await getTracksFromPool(5);
        console.log(`取得した楽曲数: ${poolTracks.length}曲\n`);

        if (poolTracks.length > 0) {
            console.log('プールから取得した楽曲:');
            poolTracks.forEach((track, index) => {
                console.log(`${index + 1}. ${track.track_name} by ${track.artist_name}`);
            });
        }

        console.log('\n=== テスト完了 ===');
    } catch (error) {
        console.error('エラーが発生しました:', error);
        process.exit(1);
    } finally {
        // テストで追加した楽曲をクリーンアップ（テスト/CI環境でのみ実行する）
        const shouldCleanup = process.env.NODE_ENV === 'test' || process.env.CI === 'true' || process.env.TEST_CLEANUP === 'true';
        if (addedTrackIds.length > 0) {
            if (shouldCleanup) {
                try {
                    const { error } = await supabase
                        .from('track_pool')
                        .delete()
                        .in('track_id', addedTrackIds);

                    if (error) {
                        console.error('Failed to cleanup test tracks:', error);
                    } else {
                        console.log(`Cleaned up ${addedTrackIds.length} test tracks from pool.`);
                    }
                } catch (cleanupError) {
                    console.error('Error during cleanup of test tracks:', cleanupError);
                }
            } else {
                console.warn('Skipping cleanup of test tracks (not test/CI environment). Set TEST_CLEANUP=true to force cleanup.');
            }
        }
    }
}

main();
