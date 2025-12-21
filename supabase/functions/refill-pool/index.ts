import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APPLE_RSS_URL = "https://rss.applemarketingtools.com/api/v2/jp/music/most-played/100/songs.json";
const USER_AGENT = "otodoki3/1.0 (Supabase Edge Function)";
const TIMEOUT_MS = 10000;

Deno.serve(async (req: Request) => {
    const startTime = Date.now();

    // Authorization check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.error('Missing or invalid Authorization header');
        return new Response(
            JSON.stringify({ success: false, error: 'Missing or invalid Authorization header' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
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

        const tracksToUpsert = results.map((item: any) => ({
            track_id: item.id,
            track_name: item.name,
            artist_name: item.artistName,
            collection_name: item.collectionName || null,
            preview_url: item.url || '', // Fallback to item.url as per existing logic
            artwork_url: item.artworkUrl100 || null,
            track_view_url: item.url || null,
            genre: item.genres?.[0]?.name || null,
            release_date: item.releaseDate || null,
            metadata: {
                source: 'apple_rss',
                fetched_from: 'chart',
                refilled_at: new Date().toISOString(),
            },
            fetched_at: new Date().toISOString(),
        })).filter((t: any) => !!t.preview_url && !!t.track_id);

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
        const { error: rpcError } = await supabase.rpc('trim_track_pool', { max_size: 10000 });
        if (rpcError) {
            console.error('Error calling trim_track_pool:', rpcError);
        }

        const durationMs = Date.now() - startTime;
        console.log(`Successfully processed ${tracksToUpsert.length} tracks in ${durationMs}ms`);

        return new Response(
            JSON.stringify({ success: true, tracksAdded: tracksToUpsert.length, durationMs }),
            { headers: { 'Content-Type': 'application/json' } }
        );

} catch (error: any) {
    console.error('Error in refill-pool function:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
});
