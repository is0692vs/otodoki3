import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';

function parseTrackId(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

async function verifyPlaylistOwnership(supabase: SupabaseClient, playlistId: string, userId: string) {
    const { data: playlist, error } = await supabase
        .from('playlists')
        .select('id')
        .eq('id', playlistId)
        .eq('user_id', userId)
        .single();

    return { playlist, error };
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const trackId = parseTrackId(body?.track_id);

    if (trackId == null) {
        return NextResponse.json({ error: 'Track ID is required and must be a number' }, { status: 400 });
    }

    // Verify playlist ownership
    const { playlist, error: playlistError } = await verifyPlaylistOwnership(supabase, id, user.id);

    if (playlistError || !playlist) {
        return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    // Get current max position
    const { data: maxPosData } = await supabase
        .from('playlist_tracks')
        .select('position')
        .eq('playlist_id', id)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle();

    const nextPosition = (maxPosData?.position ?? -1) + 1;

    const { error } = await supabase
        .from('playlist_tracks')
        .insert({
            playlist_id: id,
            track_id: trackId,
            position: nextPosition,
        });

    if (error) {
        console.error('Error adding track to playlist:', error);
        if (error.code === '23505') { // Unique violation
            return NextResponse.json({ error: 'Track already in playlist' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Failed to add track' }, { status: 500 });
    }

    // Get the track info to return in response
    const { data: trackData } = await supabase
        .from('track_pool')
        .select('track_id, track_name, artist_name, artwork_url, preview_url')
        .eq('track_id', trackId)
        .single();

    return NextResponse.json({
        success: true,
        track: trackData
    });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const trackId = parseTrackId(body?.track_id);

    if (trackId == null) {
        return NextResponse.json({ error: 'Track ID is required and must be a number' }, { status: 400 });
    }

    // Verify playlist ownership
    const { playlist, error: playlistError } = await verifyPlaylistOwnership(supabase, id, user.id);

    if (playlistError || !playlist) {
        return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    const { error } = await supabase
        .from('playlist_tracks')
        .delete()
        .eq('playlist_id', id)
        .eq('track_id', trackId);

    if (error) {
        return NextResponse.json({ error: 'Failed to remove track' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tracks } = body; // Expecting array of track_ids in the new order

    if (!tracks || !Array.isArray(tracks)) {
        return NextResponse.json({ error: 'Tracks array is required' }, { status: 400 });
    }

    // Convert all track_ids to numbers
    const numericTracks: number[] = tracks.map((trackId: unknown) => {
        const parsed = parseTrackId(trackId);
        return parsed ?? NaN;
    });

    if (numericTracks.some((trackId) => !Number.isFinite(trackId))) {
        return NextResponse.json({ error: 'All track IDs must be valid numbers' }, { status: 400 });
    }

    // Verify playlist ownership
    const { playlist, error: playlistError } = await verifyPlaylistOwnership(supabase, id, user.id);

    if (playlistError || !playlist) {
        return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    // Update positions
    const updates = numericTracks.map((trackId, index) =>
        supabase
            .from('playlist_tracks')
            .update({ position: index })
            .eq('playlist_id', id)
            .eq('track_id', trackId)
    );

    const results = await Promise.all(updates);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
        console.error('Failed to update some track positions:', errors);
        return NextResponse.json({ error: 'Failed to update order completely' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
