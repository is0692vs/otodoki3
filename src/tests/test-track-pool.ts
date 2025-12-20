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
} from '../lib/track-pool';
import { fetchTracksFromChart } from '../lib/refill-methods/chart';

async function main() {
    console.log('=== 楽曲プール管理機能のテスト ===\n');

    try {
        // 1. 現在のプールサイズを確認
        console.log('1. 現在のプールサイズを確認中...');
        const initialSize = await getPoolSize();
        console.log(`現在のプールサイズ: ${initialSize}曲\n`);

        // 2. iTunes Search APIからチャートを取得
        console.log('2. iTunes Search APIからチャート楽曲を取得中...');
        const tracks = await fetchTracksFromChart(10);
        console.log(`取得した楽曲数: ${tracks.length}曲\n`);

        if (tracks.length > 0) {
            console.log('取得した楽曲の例:');
            console.log(`- ${tracks[0].track_name} by ${tracks[0].artist_name}\n`);
        }

        // 3. プールに楽曲を追加
        console.log('3. プールに楽曲を追加中...');
        await addTracksToPool(tracks, { method: 'chart', weight: 1.0 });
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
    }
}

main();
