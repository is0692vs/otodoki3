import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
    env: { get(key: string): string | undefined };
    serve(handler: (req: Request) => Response | Promise<Response>): void;
};

// Constants - マジックナンバーを定数化
const USER_AGENT = "otodoki3/1.0 (Supabase Edge Function)";
const SCAN_TRACK_COUNT = 50;
const LISTENERS_THRESHOLD = 10000;
const LAST_FM_TIMEOUT_MS = 5000;
const RATE_LIMIT_DELAY_MS = 200;

const LAST_FM_API_KEY = Deno.env.get('LAST_FM_API_KEY');

interface TrackPoolRow {
    id: string;
    artist_name: string;
}

interface LastFmArtistStats {
    listeners?: string;
    playcount?: string;
}

interface LastFmArtist {
    name: string;
    stats?: LastFmArtistStats;
}

interface LastFmSearchResponse {
    artist?: LastFmArtist;
    error?: number;
    message?: string;
}

interface DeletedTrack {
    artist_name: string;
    listeners: number;
}

/**
 * 与えられた2つのバイト配列がタイミング攻撃に耐える方法で等しいかどうかを判定する。
 *
 * 長さが等しく、すべてのバイトが一致する場合に等しいと判断する。実行時間は入力長が等しい限り内容によらず一定となるよう設計されている。
 *
 * @param a - 比較対象の最初のバイト配列
 * @param b - 比較対象の2番目のバイト配列
 * @returns `true` の場合は配列の長さとすべてのバイトが一致、`false` の場合はそうでない
 */
function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
}

/**
 * リクエストが期待される認証ヘッダーを持つか検証する。
 *
 * 指定されたリクエストの `Authorization` ヘッダーを環境変数 `CRON_AUTH_KEY` に基づく期待値と安全な比較（タイミング攻撃を防ぐ比較）で照合する。
 * タイミング攻撃対策として、両方の値をSHA-256でハッシュ化してから比較する。
 *
 * @returns `true` ならヘッダーが一致し、`false` なら一致しない。 
 */
async function isAuthorizedRequest(req: Request): Promise<boolean> {
    const authHeader = (req.headers.get('Authorization') ?? '').trim();
    const cronAuthKey = Deno.env.get('CRON_AUTH_KEY');

    // CRON_AUTH_KEY未設定時は全リクエストを拒否（セキュアなフェイル）
    if (!cronAuthKey) {
        console.error('CRON_AUTH_KEY is not set. Denying all requests.');
        return false;
    }

    const expectedAuth = `Bearer ${cronAuthKey}`;

    // タイミング攻撃対策: 両方の値をSHA-256でハッシュ化してから比較
    const encoder = new TextEncoder();
    const authHeaderHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(authHeader)));
    const expectedAuthHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(expectedAuth)));

    return timingSafeEqualBytes(authHeaderHash, expectedAuthHash);
}

/**
 * Last.fm API を使用してアーティストのリスナー数を取得する。
 *
 * @param artistName - アーティスト名
 * @returns リスナー数。API未設定またはエラー時は null を返す。
 */
async function getLastFmListeners(artistName: string): Promise<number | null> {
    if (!LAST_FM_API_KEY) {
        console.warn('LAST_FM_API_KEY is not set. Skipping Last.fm API calls.');
        return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LAST_FM_TIMEOUT_MS);

    try {
        const url = `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artistName)}&api_key=${LAST_FM_API_KEY}&format=json`;
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': USER_AGENT },
        });

        if (!response.ok) {
            console.warn(`Last.fm API returned ${response.status} for artist: ${artistName}`);
            return null;
        }

        const data = (await response.json()) as LastFmSearchResponse;
        if (data?.error) {
            console.warn(`Last.fm API error for artist: ${artistName}`, data.message);
            return null;
        }

        const listenersRaw = data?.artist?.stats?.listeners;
        if (typeof listenersRaw !== 'string') return null;

        const listeners = parseInt(listenersRaw, 10);
        if (!Number.isFinite(listeners)) return null;

        return listeners;
    } catch (error) {
        // エラー時はスキップ（fail-open）
        console.warn(`Failed to fetch Last.fm data for artist: ${artistName}`, error);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

Deno.serve(async (req: Request) => {
    const startTime = Date.now();

    // HTTPメソッド制限
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ success: false, error: 'Method Not Allowed' }),
            { status: 405, headers: { 'Content-Type': 'application/json', 'Allow': 'POST' } },
        );
    }

    // 認証チェック
    if (!(await isAuthorizedRequest(req))) {
        console.error('Unauthorized request');
        return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
        );
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1) track_pool からランダムに50件取得
        // PostgRESTはorder by random()をサポートしていないため、RPCを使用
        const { data: randomTracks, error: fetchError } = await supabase
            .rpc('get_random_tracks_for_cleanup', { limit_count: SCAN_TRACK_COUNT });

        if (fetchError) {
            console.error('Failed to fetch tracks from track_pool:', fetchError);
            throw fetchError;
        }

        const tracks = (randomTracks ?? []) as TrackPoolRow[];
        const scannedCount = tracks.length;

        console.log(`[Cleanup] Scanned: ${scannedCount} tracks`);

        if (scannedCount === 0) {
            const durationMs = Date.now() - startTime;
            return new Response(
                JSON.stringify({
                    success: true,
                    scanned: 0,
                    deleted: 0,
                    deletedTracks: [],
                    durationMs,
                }),
                { headers: { 'Content-Type': 'application/json' } },
            );
        }

        // 2) Last.fm API を呼び出して各アーティストのリスナー数を取得
        // 並列化してパフォーマンス改善（レート制限は各リクエストの開始時間をずらすことで対応）
        const results = await Promise.all(
            tracks.map((track, index) =>
                new Promise<{ track: TrackPoolRow; listeners: number | null }>((resolve) =>
                    setTimeout(
                        () =>
                            getLastFmListeners(track.artist_name)
                                .then((listeners) => resolve({ track, listeners }))
                                .catch(() => resolve({ track, listeners: null })),
                        index * RATE_LIMIT_DELAY_MS
                    )
                )
            )
        );

        const deletedTracks: DeletedTrack[] = [];
        const trackIdsToDelete: string[] = [];

        for (const { track, listeners } of results) {
            // null の場合はスキップ（fail-open）
            if (listeners === null) {
                continue;
            }

            // 3) リスナー数が閾値未満の場合は削除対象に追加
            if (listeners < LISTENERS_THRESHOLD) {
                trackIdsToDelete.push(track.id);
                deletedTracks.push({
                    artist_name: track.artist_name,
                    listeners,
                });
                console.log(`[Deleted] ${track.artist_name} - listeners: ${listeners}`);
            }
        }

        // 4) 削除処理
        let deletedCount = 0;
        if (trackIdsToDelete.length > 0) {
            const { error: deleteError, count } = await supabase
                .from('track_pool')
                .delete({ count: 'exact' })
                .in('id', trackIdsToDelete);

            if (deleteError) {
                console.error('Failed to delete tracks:', deleteError);
                throw deleteError;
            }

            deletedCount = count ?? 0;
        }

        console.log(`[Cleanup] Deleted: ${deletedCount} tracks (listeners < ${LISTENERS_THRESHOLD})`);

        const durationMs = Date.now() - startTime;

        return new Response(
            JSON.stringify({
                success: true,
                scanned: scannedCount,
                deleted: deletedCount,
                deletedTracks,
                durationMs,
            }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    } catch (error: unknown) {
        // 内部ログには詳細なエラー情報を出力
        console.error('Error in cleanup-pool function:', error);
        // クライアントには汎用的なエラーメッセージのみを返す
        return new Response(
            JSON.stringify({
                success: false,
                error: 'An internal server error occurred'
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
});
