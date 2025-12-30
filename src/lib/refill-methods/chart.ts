import type { Track } from '@/types/track-pool';

/**
 * Apple RSS Feed APIのレスポンス型（簡易）
 */
interface AppleRssResult {
    id: string;
    name: string;
    artistName: string;
    url?: string;
    artworkUrl100?: string;
    // 他のフィールドは無視
}

interface AppleRssResponse {
    feed: {
        results: AppleRssResult[];
    };
}

/**
 * iTunes Search API のレスポンス型
 */
interface ItunesSearchResult {
    trackId: number;
    trackName: string;
    artistName: string;
    previewUrl?: string;
    artworkUrl100?: string;
    trackViewUrl?: string;
    collectionName?: string;
    genre?: string;
    releaseDate?: string;
}

interface ItunesSearchResponse {
    results: ItunesSearchResult[];
}

/**
 * iTunes Search API から previewUrl を取得（キャッシュなし）
 */
async function getPreviewUrlFromItunesApi(
    trackId: string,
    timeoutMs: number = 3000
): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(trackId)}&country=jp`;
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'otodoki/1.0' },
        });

        if (!response.ok) {
            console.warn(`iTunes API lookup failed for track ${trackId}: ${response.status}`);
            return null;
        }

        const data = (await response.json()) as ItunesSearchResponse;
        const result = data.results?.[0];

        if (!result?.previewUrl) {
            console.warn(`No previewUrl found for track ${trackId}`);
            return null;
        }

        return result.previewUrl;
    } catch (error) {
        if (error instanceof Error && (error.name === 'AbortError' || (error as { code?: string }).code === 'ABORT_ERR')) {
            console.warn(`iTunes API lookup timeout for track ${trackId}`);
        } else {
            console.warn(`iTunes API lookup error for track ${trackId}:`, error);
        }
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * iTunesチャート（Apple RSS）を使用してチャート上位の楽曲を取得
 * @param limit 取得する楽曲数（デフォルト: 50）
 * @param options.timeoutMs タイムアウト（ミリ秒、デフォルト: 5000）
 * @param options.userAgent オプションの User-Agent ヘッダ
 */
export async function fetchTracksFromChart(
    limit: number = 50,
    options?: { timeoutMs?: number; userAgent?: string }
): Promise<Track[]> {
    const timeoutMs = options?.timeoutMs ?? 5000;
    const userAgent = options?.userAgent ?? `otodoki/1.0`;

    // Apple RSS Charts API (no auth required)
    const url = `https://rss.applemarketingtools.com/api/v2/jp/music/most-played/${limit}/songs`;
    console.log(`Fetching tracks from Apple RSS Charts API: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: userAgent ? { 'User-Agent': userAgent } : undefined,
        });

        if (response.status === 429) {
            // レート制限
            throw new Error('Apple RSS Charts API rate limit exceeded. Please try again later.');
        }

        if (!response.ok) {
            throw new Error(
                `Apple RSS Charts API request failed with status ${response.status}: ${response.statusText}`
            );
        }

        const data = (await response.json()) as AppleRssResponse;

        const results = data?.feed?.results ?? [];

        if (!results || results.length === 0) {
            console.warn('No tracks found from Apple RSS Charts API.');
            return [];
        }

        // Apple RSS APIのデータから Track を構築
        // previewUrl は iTunes Search API から別途取得する
        const tracks: Track[] = [];

        for (const item of results) {
            // iTunes Search API から previewUrl を取得
            const previewUrl = await getPreviewUrlFromItunesApi(item.id);

            // previewUrl がない場合はスキップ（再生不可）
            if (!previewUrl) {
                console.warn(`Skipping track ${item.id} (${item.name}) - no previewUrl available`);
                continue;
            }

            const trackId = Number(item.id);
            if (!Number.isFinite(trackId)) {
                console.warn(`Skipping track with invalid id from RSS: ${item.id}`);
                continue;
            }

            const track: Track = {
                type: 'track',  // ← 追加
                track_id: trackId,
                track_name: item.name,
                artist_name: item.artistName,
                collection_name: undefined,
                preview_url: previewUrl, // ✅ iTunes Search API から取得した previewUrl
                artwork_url: item.artworkUrl100,
                track_view_url: item.url ?? undefined, // ✅ Apple Music ページ URL
                genre: undefined,
                release_date: undefined,
                metadata: {
                    source: 'apple_rss',
                    fetched_from: 'chart',
                },
            };

            tracks.push(track);
        }

        console.log(`Successfully fetched ${tracks.length} tracks from Apple RSS Charts API (with previewUrl).`);
        return tracks;
    } catch (error) {
        // abortされた場合は特有の処理
        if (error instanceof Error && (error.name === 'AbortError' || (error as { code?: string }).code === 'ABORT_ERR')) {
            console.error('Apple RSS Charts API request aborted due to timeout.');
            throw new Error('Request to Apple RSS Charts API timed out.');
        }

        console.error('Error fetching tracks from chart:', error);
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * リトライ機能付きでチャートから楽曲を取得（指数バックオフ + ジッター）
 * @param limit 取得する楽曲数
 * @param maxRetries 最大リトライ回数（デフォルト: 3）
 * @param baseDelay 基本遅延（ミリ秒、デフォルト: 1000）
 * @param maxDelay 最大遅延（ミリ秒、デフォルト: 30000）
 * @param jitterFactor ジッター割合（0-1、デフォルト: 0.5）
 */
export async function fetchTracksFromChartWithRetry(
    limit: number = 50,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    maxDelay: number = 30000,
    jitterFactor: number = 0.5
): Promise<Track[]> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fetchTracksFromChart(limit);
        } catch (error) {
            lastError = error as Error;
            console.error(`Attempt ${attempt} failed:`, error);

            if (attempt < maxRetries) {
                // 指数バックオフ
                const expDelay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt - 1));
                // ジッター（±0.5*expDelay）
                const jitter = (Math.random() - 0.5) * expDelay;
                const delay = Math.max(0, Math.round(expDelay + jitter * Math.min(jitterFactor, 1)));

                console.log(`Retrying in ${delay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    throw new Error(`Failed to fetch tracks after ${maxRetries} attempts: ${lastError?.message}`);
}
