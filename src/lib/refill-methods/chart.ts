import type { Track } from '@/types/track-pool';

/**
 * iTunes Search APIのレスポンス型定義
 */
interface ITunesTrack {
    trackId: number;
    trackName: string;
    artistName: string;
    collectionName?: string;
    previewUrl: string;
    artworkUrl100?: string;
    trackViewUrl?: string;
    primaryGenreName?: string;
    releaseDate?: string;
}

interface ITunesSearchResponse {
    resultCount: number;
    results: ITunesTrack[];
}

/**
 * iTunes Search APIを使用してチャート上位の楽曲を取得
 * @param limit 取得する楽曲数（デフォルト: 50）
 * @returns Track配列
 */
export async function fetchTracksFromChart(limit: number = 50): Promise<Track[]> {
    try {
        // iTunes Search APIのエンドポイント
        const baseUrl = 'https://itunes.apple.com/search';
        const params = new URLSearchParams({
            term: 'music',
            limit: limit.toString(),
            media: 'music',
            entity: 'song',
            country: 'JP', // 日本のチャートを取得
        });

        const url = `${baseUrl}?${params.toString()}`;
        console.log(`Fetching tracks from iTunes Search API: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(
                `iTunes Search API request failed with status ${response.status}: ${response.statusText}`
            );
        }

        const data: ITunesSearchResponse = await response.json();

        if (!data.results || data.results.length === 0) {
            console.warn('No tracks found from iTunes Search API.');
            return [];
        }

        // iTunes APIのレスポンスをTrack型に変換
        const tracks: Track[] = data.results
            .filter((item) => item.previewUrl) // プレビューURLが存在するものだけを取得
            .map((item) => ({
                track_id: item.trackId.toString(), // BigIntをstringに変換
                track_name: item.trackName,
                artist_name: item.artistName,
                collection_name: item.collectionName,
                preview_url: item.previewUrl,
                artwork_url: item.artworkUrl100,
                track_view_url: item.trackViewUrl,
                genre: item.primaryGenreName,
                release_date: item.releaseDate
                    ? new Date(item.releaseDate).toISOString().split('T')[0]
                    : undefined,
                metadata: {
                    source: 'itunes_search_api',
                    fetched_from: 'chart',
                },
            }));

        console.log(`Successfully fetched ${tracks.length} tracks from iTunes Search API.`);
        return tracks;
    } catch (error) {
        console.error('Error fetching tracks from chart:', error);

        // レート制限エラーの場合
        if (error instanceof Error && error.message.includes('429')) {
            console.warn('Rate limit exceeded. Please try again later.');
            throw new Error('iTunes Search API rate limit exceeded. Please try again later.');
        }

        throw error;
    }
}

/**
 * リトライ機能付きでチャートから楽曲を取得
 * @param limit 取得する楽曲数
 * @param maxRetries 最大リトライ回数（デフォルト: 3）
 * @param retryDelay リトライ間隔（ミリ秒、デフォルト: 1000）
 * @returns Track配列
 */
export async function fetchTracksFromChartWithRetry(
    limit: number = 50,
    maxRetries: number = 3,
    retryDelay: number = 1000
): Promise<Track[]> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fetchTracksFromChart(limit);
        } catch (error) {
            lastError = error as Error;
            console.error(`Attempt ${attempt} failed:`, error);

            if (attempt < maxRetries) {
                console.log(`Retrying in ${retryDelay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
        }
    }

    throw new Error(
        `Failed to fetch tracks after ${maxRetries} attempts: ${lastError?.message}`
    );
}
