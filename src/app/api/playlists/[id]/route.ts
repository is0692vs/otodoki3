import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (id === 'likes' || id === 'dislikes') {
        const table = id === 'likes' ? 'likes' : 'dislikes';
        const { data: tracks, error } = await supabase
            .from(table)
            .select(`
        *,
        track:track_pool(*)
      `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: `Failed to fetch ${id}` }, { status: 500 });
        }

        const formattedTracks = tracks?.map(t => t.track).filter(t => t !== null) || [];

        return NextResponse.json({ tracks: formattedTracks });
    }

    // Custom Playlist
    const { data: playlist, error: playlistError } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

    if (playlistError || !playlist) {
        return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    const { data: tracks, error: tracksError } = await supabase
        .from('playlist_tracks')
        .select(`
      *,
      track:track_pool(*)
    `)
        .eq('playlist_id', id)
        .order('position', { ascending: true });

    if (tracksError) {
        return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 });
    }

    const formattedTracks = tracks?.map(t => ({
        ...t.track,
        playlist_track_id: t.id,
        position: t.position,
        added_at: t.added_at
    })).filter(t => t.id !== undefined) || []; // Filter out any potential null joins

    return NextResponse.json({ playlist, tracks: formattedTracks });
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

    if (id === 'likes' || id === 'dislikes') {
        return NextResponse.json({ error: 'Cannot update default playlists' }, { status: 403 });
    }

    const body = await request.json();
    const { title } = body;

    if (!title) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const { error } = await supabase
        .from('playlists')
        .update({ title })
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        return NextResponse.json({ error: 'Failed to update playlist' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
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

    if (id === 'likes' || id === 'dislikes') {
        return NextResponse.json({ error: 'Cannot delete default playlists' }, { status: 403 });
    }

    // Delete tracks first to avoid FK constraints if cascade is not set
    const { error: tracksError } = await supabase
        .from('playlist_tracks')
        .delete()
        .eq('playlist_id', id);

    if (tracksError) {
        return NextResponse.json({ error: 'Failed to delete playlist tracks' }, { status: 500 });
    }

    const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        return NextResponse.json({ error: 'Failed to delete playlist' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
