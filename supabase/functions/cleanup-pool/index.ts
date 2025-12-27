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
    artist: string;
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
    artist: string;
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
 *
 * @returns `true` ならヘッダーが一致し、`false` なら一致しない。 
 */
function isAuthorizedRequest(req: Request): boolean {
    const authHeader = req.headers.get('Authorization') ?? '';
    const cronAuthKey = Deno.env.get('CRON_AUTH_KEY');

    // CRON_AUTH_KEY未設定時は全リクエストを拒否（セキュアなフェイル）
    if (!cronAuthKey) {
        console.error('CRON_AUTH_KEY is not set. Denying all requests.');
        return false;
    }

    const expectedAuth = `Bearer ${cronAuthKey}`;

    const encoder = new TextEncoder();
    return timingSafeEqualBytes(encoder.encode(authHeader), encoder.encode(expectedAuth));
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

    // 認証チェック
    if (!isAuthorizedRequest(req)) {
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
        const { data: randomTracks, error: fetchError } = await supabase
            .from('track_pool')
            .select('id, artist')
            .limit(SCAN_TRACK_COUNT)
            .order('random()', { ascending: true });

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
        const deletedTracks: DeletedTrack[] = [];
        const trackIdsToDelete: string[] = [];

        for (const track of tracks) {
            const listeners = await getLastFmListeners(track.artist);

            // レート制限対策: 各リクエスト間に200msの遅延
            await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));

            // null の場合はスキップ（fail-open）
            if (listeners === null) {
                continue;
            }

            // 3) リスナー数が閾値未満の場合は削除対象に追加
            if (listeners < LISTENERS_THRESHOLD) {
                trackIdsToDelete.push(track.id);
                deletedTracks.push({
                    artist: track.artist,
                    listeners,
                });
                console.log(`[Deleted] ${track.artist} - listeners: ${listeners}`);
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

            deletedCount = count ?? trackIdsToDelete.length;
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
        console.error('Error in cleanup-pool function:', error);
        return new Response(
            JSON.stringify({ 
                success: false, 
                error: error instanceof Error ? error.message : 'An internal server error occurred'
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
});
