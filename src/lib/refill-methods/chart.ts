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

        // RSS APIのレスポンスをTrack型に変換
        const tracks: Track[] = results
            .map((item) => ({
                track_id: item.id.toString(),
                track_name: item.name,
                artist_name: item.artistName,
                collection_name: undefined,
                preview_url: item.url ?? '', // RSSにはpreviewが無い場合がある
                artwork_url: item.artworkUrl100,
                track_view_url: item.url,
                genre: undefined,
                release_date: undefined,
                metadata: {
                    source: 'apple_rss',
                    fetched_from: 'chart',
                },
            }))
            // preview_urlが空文字列の場合はフィルタリング
            .filter((t) => !!t.preview_url);

        console.log(`Successfully fetched ${tracks.length} tracks from Apple RSS Charts API.`);
        return tracks;
    } catch (error) {
        // abortされた場合は特有の処理
        if (error instanceof Error && (error.name === 'AbortError' || (error as any).code === 'ABORT_ERR')) {
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
