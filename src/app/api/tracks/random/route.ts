import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * 配列の要素をランダムな順序に並べ替えた新しい配列を作成する。
 *
 * @param array - 元の配列（破壊的変更は行わない）
 * @returns 引数 `array` の要素をランダムな順序に並べた新しい配列
 */
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * トラックプールからランダムに選んだトラックを返す API エンドポイントを処理する。
 *
 * @param request - Next.js のリクエスト。クエリパラメータ `count` を受け取り、返すトラック数を指定します（デフォルト 10、範囲 1〜100 に制限）。
 * @returns 成功時は `{ success: true, tracks: [...] }` を含む JSON、失敗時は `{ success: false, error: '...' }` を含む JSON
 */
export async function GET(request: NextRequest) {
    try {
        // Parse count parameter (default: 10, max: 100)
        const { searchParams } = new URL(request.url);
        const countParam = searchParams.get('count');
        const parsedCount = parseInt(countParam || '10', 10);
        const count = Math.min(
            Math.max(1, Number.isNaN(parsedCount) ? 10 : parsedCount),
            100
        );

        // Fetch count * 3 tracks to improve shuffle quality
        const fetchCount = count * 3;
        const { data: tracks, error } = await supabase
            .from('track_pool')
            .select('*')
            .order('fetched_at', { ascending: false })
            .limit(fetchCount);

        if (error) {
            console.error('Failed to fetch tracks from pool:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch tracks' },
                { status: 500 }
            );
        }

        if (!tracks || tracks.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No tracks available in pool' },
                { status: 404 }
            );
        }

        // Shuffle and take requested count
        const shuffled = shuffleArray(tracks);
        const result = shuffled.slice(0, count);

        return NextResponse.json({
            success: true,
            tracks: result,
        });
    } catch (err) {
        console.error('Unexpected error in /api/tracks/random:', err);
        return NextResponse.json(
            { success: false, error: 'An internal server error occurred' },
            { status: 500 }
        );
    }
}