import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APPLE_RSS_URL = "https://rss.applemarketingtools.com/api/v2/jp/music/most-played/100/songs.json";
const USER_AGENT = "otodoki3/1.0 (Supabase Edge Function)";
const TIMEOUT_MS = 10000;

/**
 * iTunes Search API から previewUrl を取得
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
            headers: { 'User-Agent': USER_AGENT },
        });

        if (!response.ok) {
            console.warn(`iTunes API lookup failed for track ${trackId}: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const result = data.results?.[0];

        if (!result?.previewUrl) {
            console.warn(`No previewUrl found for track ${trackId}`);
            return null;
        }

        return result.previewUrl;
    } catch (error) {
        if (error instanceof Error && (error.name === 'AbortError' || error.code === 'ABORT_ERR')) {
            console.warn(`iTunes API lookup timeout for track ${trackId}`);
        } else {
            console.warn(`iTunes API lookup error for track ${trackId}:`, error);
        }
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

interface AppleRssTrack {
    id: string;
    name: string;
    artistName: string;
    collectionName?: string;
    url: string;
    artworkUrl100?: string;
    genres?: { name: string }[];
    releaseDate?: string;
    previewUrl?: string; // iTunes Search API の previewUrl フィールド
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

Deno.serve(async (req: Request) => {
    const startTime = Date.now();

    // Authorization check - verify Bearer token against CRON_AUTH_KEY
    const authHeader = req.headers.get('Authorization');
    const cronAuthKey = Deno.env.get('CRON_AUTH_KEY');
    const expectedAuth = cronAuthKey ? `Bearer ${cronAuthKey}` : '';

    if (authHeader !== expectedAuth) {
        console.error('Unauthorized request');
        return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        }
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        console.log(`Fetching tracks from Apple RSS Charts API: ${APPLE_RSS_URL}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(APPLE_RSS_URL, {
            headers: { 'User-Agent': USER_AGENT },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Apple RSS API returned ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const results = data?.feed?.results ?? [];

        if (results.length === 0) {
            console.log('No tracks found in RSS feed.');
            return new Response(
                JSON.stringify({ success: true, tracksAdded: 0, durationMs: Date.now() - startTime }),
                { headers: { 'Content-Type': 'application/json' } }
            );
        }

        // iTunes Search API から previewUrl を取得しながら TrackPoolEntry を作成
        const tracksToUpsert: TrackPoolEntry[] = [];

        for (const item of results) {
            // iTunes Search API から previewUrl を取得
            const previewUrl = await getPreviewUrlFromItunesApi(item.id);

            // previewUrl がない場合はスキップ
            if (!previewUrl) {
                console.warn(`Skipping track ${item.id} (${item.name}) - no previewUrl available`);
                continue;
            }

            tracksToUpsert.push({
                track_id: item.id,
                track_name: item.name,
                artist_name: item.artistName,
                collection_name: item.collectionName || null,
                preview_url: previewUrl, // ✅ iTunes Search API から取得した previewUrl
                artwork_url: item.artworkUrl100 || null,
                track_view_url: item.url || null, // ✅ Apple Music ページ URL
                genre: item.genres?.[0]?.name || null,
                release_date: item.releaseDate || null,
                metadata: {
                    source: 'apple_rss',
                    fetched_from: 'chart',
                    refilled_at: new Date().toISOString(),
                },
                fetched_at: new Date().toISOString(),
            });
        }

        if (tracksToUpsert.length > 0) {
            console.log(`Upserting ${tracksToUpsert.length} tracks to track_pool...`);
            const { error: upsertError } = await supabase
                .from('track_pool')
                .upsert(tracksToUpsert, { onConflict: 'track_id' });

            if (upsertError) {
                throw upsertError;
            }
        } else {
            console.warn('No valid tracks to upsert.');
        }

        // Trim pool
        console.log('Trimming track pool...');
        const maxSize = parseInt(Deno.env.get('TRACK_POOL_MAX_SIZE') ?? '10000', 10);
        const { error: rpcError } = await supabase.rpc('trim_track_pool', { max_size: maxSize });
        if (rpcError) {
            console.error('Error calling trim_track_pool:', rpcError);
            throw rpcError;
        }

        const durationMs = Date.now() - startTime;
        console.log(`Successfully processed ${tracksToUpsert.length} tracks in ${durationMs}ms`);

        return new Response(
            JSON.stringify({ success: true, tracksAdded: tracksToUpsert.length, durationMs }),
            { headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error: unknown) {
        console.error('Error in refill-pool function:', error);
        return new Response(
            JSON.stringify({ success: false, error: 'An internal server error occurred' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
});
