import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: {
    env: { get(key: string): string | undefined };
    serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const USER_AGENT = "otodoki3/1.0 (Supabase Edge Function)";
const ITUNES_TIMEOUT_MS = 10000;
const ARTIST_PICK_COUNT = 5;
const LAST_FM_API_KEY = Deno.env.get('LAST_FM_API_KEY');
const LISTENERS_THRESHOLD = 10000;
const LAST_FM_TIMEOUT_MS = 5000;
const RATE_LIMIT_DELAY_MS = 200;

interface iTunesSearchResult {
    trackId: number;
    trackName: string;
    artistName: string;
    collectionName?: string;
    previewUrl?: string;
    artworkUrl100?: string;
    primaryGenreName?: string;
    releaseDate?: string;
    trackViewUrl?: string;
}

interface iTunesSearchResponse {
    resultCount: number;
    results: iTunesSearchResult[];
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

interface TrackPoolEntry {
    track_id: string;
    track_name: string;
    artist_name: string;
    collection_name: string | null;
    preview_url: string;
    artwork_url: string | null;
    track_view_url: string | null;
    genre: string | null;
    release_date: string | null;
    metadata: {
        source: string;
        fetched_from: string;
        refilled_at: string;
    };
    fetched_at: string;
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
 * 指定したアーティスト名で iTunes Search API を検索して楽曲の結果を取得する。
 *
 * @returns iTunes Search API から得られた曲の結果配列。結果がない場合は空配列を返す。
 * @throws iTunes Search API が非 OK ステータスを返した場合に Error をスローする。
 */
async function fetchItunesSearchByArtist(artistName: string): Promise<iTunesSearchResult[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ITUNES_TIMEOUT_MS);

    try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&media=music&entity=song&country=JP&limit=20`;
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': USER_AGENT },
        });

        if (!response.ok) {
            throw new Error(`iTunes Search API returned ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as iTunesSearchResponse;
        return Array.isArray(data?.results) ? data.results : [];
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Last.fm API を使用してアーティストのリスナー数を取得する。
 *
 * @param artistName - アーティスト名
 * @returns リスナー数。API未設定またはエラー時は null を返す。
 */
async function getArtistListeners(artistName: string): Promise<number | null> {
    if (!LAST_FM_API_KEY) return null;

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
        if (data?.error) return null;

        const listenersRaw = data?.artist?.stats?.listeners;
        if (typeof listenersRaw !== 'string') return null;

        const listeners = parseInt(listenersRaw, 10);
        if (!Number.isFinite(listeners)) return null;

        return listeners;
    } catch (error) {
        console.warn(`Failed to fetch Last.fm data for artist: ${artistName}`, error);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * 高解像度のアートワークURLを生成します。
 *
 * @param artworkUrl100 - 100x100のアートワークURL（iTunes APIの`artworkUrl100`形式）
 * @returns 1000x1000サイズに変換したURL、入力が未定義または空文字の場合は`null`
 */
function toHighQualityArtworkUrl(artworkUrl100?: string): string | null {
    if (!artworkUrl100) return null;
    return artworkUrl100.replace('100x100bb', '1000x1000bb');
}

Deno.serve(async (req: Request) => {
    const startTime = Date.now();

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

        // 1) Pick random tracks from pool
        const { data: randomTracks, error: randomError } = await supabase
            .rpc('get_random_artists', { limit_count: ARTIST_PICK_COUNT });

        if (randomError) throw randomError;

        const typedRandomTracks = (randomTracks ?? []) as Array<{ artist_name: string | null }>;

        const artistNames = Array.from(
            new Set(
                typedRandomTracks
                    .map((row) => row.artist_name ?? '')
                    .map((name: string) => name.trim())
                    .filter((name: string) => name.length > 0),
            ),
        );

        if (artistNames.length === 0) {
            const durationMs = Date.now() - startTime;
            return new Response(
                JSON.stringify({
                    success: true,
                    artistsPicked: 0,
                    tracksUpserted: 0,
                    durationMs,
                }),
                { headers: { 'Content-Type': 'application/json' } },
            );
        }

        // 2) Fetch related songs per artist (continue even if some artists fail)
        const refilledAt = new Date().toISOString();
        const fetchedAt = refilledAt;

        let artistsSucceeded = 0;
        let artistsFailed = 0;
        let artistsSkippedByListeners = 0;

        let tracksFetched = 0;
        let tracksSkippedNoPreview = 0;

        const tracksToUpsert: TrackPoolEntry[] = [];

        for (const artistName of artistNames) {
            try {
                // Last.fm でリスナー数チェック
                const listeners = await getArtistListeners(artistName);
                if (listeners !== null && listeners < LISTENERS_THRESHOLD) {
                    console.log(
                        `[Artist: ${artistName}] Skipped: listeners ${listeners} < ${LISTENERS_THRESHOLD}`
                    );
                    artistsSkippedByListeners += 1;
                    if (LAST_FM_API_KEY) {
                        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
                    }
                    continue;
                }

                if (listeners !== null) {
                    console.log(`[Artist: ${artistName}] Listeners: ${listeners}`);
                }

                // レート制限対策: Last.fm API呼び出し後に待機（APIキー設定時のみ）
                if (LAST_FM_API_KEY) {
                    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
                }

                // iTunes API で楽曲を取得
                const items = await fetchItunesSearchByArtist(artistName);
                const fetchedCount = items.length;
                console.log(`[Artist: ${artistName}] Fetched ${fetchedCount} tracks from iTunes API`);

                // アーティスト名の厳密マッチングフィルタを適用
                const lowercasedArtistName = artistName.toLowerCase();
                const filteredItems = items.filter((item) => {
                    return item.artistName?.toLowerCase() === lowercasedArtistName;
                });

                const filteredCount = filteredItems.length;
                console.log(
                    `[Artist: ${artistName}] After filtering: ${filteredCount} tracks (filtered out: ${fetchedCount - filteredCount})`
                );

                tracksFetched += fetchedCount;

                let tracksAddedForArtist = 0;
                for (const item of filteredItems) {
                    if (!item.previewUrl) {
                        tracksSkippedNoPreview += 1;
                        continue;
                    }

                    tracksToUpsert.push({
                        track_id: String(item.trackId),
                        track_name: item.trackName,
                        artist_name: item.artistName,
                        collection_name: item.collectionName ?? null,
                        preview_url: item.previewUrl,
                        artwork_url: toHighQualityArtworkUrl(item.artworkUrl100),
                        track_view_url: item.trackViewUrl ?? null,
                        genre: item.primaryGenreName ?? null,
                        release_date: item.releaseDate ?? null,
                        metadata: {
                            source: 'itunes_search',
                            fetched_from: 'artist',
                            refilled_at: refilledAt,
                        },
                        fetched_at: fetchedAt,
                    });
                    tracksAddedForArtist += 1;
                }

                if (tracksAddedForArtist > 0) {
                    artistsSucceeded += 1;
                }
            } catch (error) {
                artistsFailed += 1;
                console.warn(`Artist processing failed for ${artistName}:`, error);
            }
        }

        // 3) Upsert
        if (tracksToUpsert.length > 0) {
            const { error: upsertError } = await supabase
                .from('track_pool')
                .upsert(tracksToUpsert, { onConflict: 'track_id' });

            if (upsertError) throw upsertError;
        }

        // 4) Trim pool
        const defaultMaxSize = 10000;
        const maxSizeStr = Deno.env.get('TRACK_POOL_MAX_SIZE') ?? String(defaultMaxSize);
        let maxSize = parseInt(maxSizeStr, 10);

        if (isNaN(maxSize)) {
            console.warn(`Invalid TRACK_POOL_MAX_SIZE: "${maxSizeStr}". Falling back to default: ${defaultMaxSize}`);
            maxSize = defaultMaxSize;
        }

        const { error: rpcError } = await supabase.rpc('trim_track_pool', { max_size: maxSize });
        if (rpcError) throw rpcError;

        const durationMs = Date.now() - startTime;

        return new Response(
            JSON.stringify({
                success: true,
                artistsPicked: artistNames.length,
                artistsSucceeded,
                artistsFailed,
                artistsSkippedByListeners,
                tracksFetched,
                tracksSkippedNoPreview,
                tracksUpserted: tracksToUpsert.length,
                durationMs,
            }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    } catch (error: unknown) {
        console.error('Error in refill-pool-artist function:', error);
        return new Response(
            JSON.stringify({ success: false, error: 'An internal server error occurred' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
});