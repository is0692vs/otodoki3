import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

// Constants for user activity filtering
const DISLIKE_EXCLUDE_DAYS = 30;
const LIKE_EXCLUDE_DAYS = 7;
const MAX_EXCLUDE = 1000;

/**
 * トラックプールからランダムに選んだトラックを返す API エンドポイントを処理する。
 * 認証済みユーザーの場合は、履歴に基づいて自動的にフィルタリングを行う。
 *
 * @param request - Next.js のリクエスト。クエリパラメータ `count` を受け取り、返すトラック数を指定します（デフォルト 10、範囲 1〜100 に制限）。
 * @returns 成功時は `{ success: true, tracks: [...] }` を含む JSON、失敗時は `{ success: false, error: '...' }` を含む JSON
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Parse count parameter (default: 10, max: 100)
        const { searchParams } = new URL(request.url);
        const countParam = searchParams.get('count');
        const parsedCount = parseInt(countParam || '10', 10);
        const count = Math.min(
            Math.max(1, Number.isNaN(parsedCount) ? 10 : parsedCount),
            100
        );

        // 認証チェック（オプショナル - 未認証でも動作）
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
            console.error('Failed to fetch authenticated user:', authError);
        }
        const user = authData?.user ?? null;

        let excludedTrackIds: number[] = [];

        if (user) {
            // Calculate date thresholds using constants
            const thirtyDaysAgo = new Date(
                Date.now() - DISLIKE_EXCLUDE_DAYS * 24 * 60 * 60 * 1000
            ).toISOString();
            const sevenDaysAgo = new Date(
                Date.now() - LIKE_EXCLUDE_DAYS * 24 * 60 * 60 * 1000
            ).toISOString();

            // Fetch dislikes and likes in parallel for better performance
            const [
                { data: dislikes, error: dislikeError },
                { data: likes, error: likeError }
            ] = await Promise.all([
                supabase
                    .from('dislikes')
                    .select('track_id')
                    .eq('user_id', user.id)
                    .gte('created_at', thirtyDaysAgo),
                supabase
                    .from('likes')
                    .select('track_id')
                    .eq('user_id', user.id)
                    .gte('created_at', sevenDaysAgo),
            ]);

            if (dislikeError) {
                console.error('Failed to fetch dislikes for filtering:', {
                    error: dislikeError,
                    userId: user.id,
                });
            } else if (dislikes) {
                excludedTrackIds.push(...dislikes.map(d => d.track_id));
            }

            if (likeError) {
                console.error('Failed to fetch likes for filtering:', {
                    error: likeError,
                    userId: user.id,
                });
            } else if (likes) {
                excludedTrackIds.push(...likes.map(l => l.track_id));
            }

            // 重複除去
            excludedTrackIds = [...new Set(excludedTrackIds)];

            // Truncate if exceeds max to prevent query string length issues
            if (excludedTrackIds.length > MAX_EXCLUDE) {
                console.debug(
                    `Excluded IDs truncated from ${excludedTrackIds.length} to ${MAX_EXCLUDE}`,
                    { userId: user.id }
                );
                excludedTrackIds = excludedTrackIds.slice(0, MAX_EXCLUDE);
            }
        }

        // プールから取得（小さなバッファのみ - 除外IDはデータベースでフィルタ済み）
        const fetchCount = count + 20;

        // Note: Sorting by fetched_at is omitted for better performance.
        // Results are shuffled client-side anyway, so DB-level sorting is unnecessary.
        let query = supabase
            .from('track_pool')
            .select('*')
            .limit(fetchCount);

        // 除外リストがある場合はフィルタリング
        if (excludedTrackIds.length > 0) {
            query = query.not('track_id', 'in', `(${excludedTrackIds.join(',')})`);
        }

        const { data: tracks, error } = await query;

        if (error) {
            console.error('Failed to fetch tracks from pool:', {
                error,
                userId: user?.id,
            });
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
