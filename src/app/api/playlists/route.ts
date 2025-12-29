import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // デフォルトプレイリストのメタ情報を返却
    const [likesCount, dislikesCount, userPlaylists] = await Promise.all([
        supabase.from('likes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('dislikes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('playlists').select('*, playlist_tracks(count)').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    if (likesCount.error) console.error('Failed to count likes:', likesCount.error);
    if (dislikesCount.error) console.error('Failed to count dislikes:', dislikesCount.error);
    if (userPlaylists.error) console.error('Failed to fetch user playlists:', userPlaylists.error);

    const defaultPlaylists = [
        { id: 'likes', name: 'お気に入り', icon: '❤️', count: likesCount.count ?? 0, is_default: true },
        { id: 'dislikes', name: 'スキップ済み', icon: '🚫', count: dislikesCount.count ?? 0, is_default: true },
    ];

    type PlaylistRow = { id: string; title: string; playlist_tracks?: Array<{ count?: number }>; };
    const customPlaylists = (userPlaylists.data as PlaylistRow[] | undefined)?.map(p => ({
        id: p.id,
        name: p.title,
        icon: '🎵',
        count: p.playlist_tracks?.[0]?.count ?? 0,
        is_default: false
    })) ?? [];

    return NextResponse.json({
        playlists: [...defaultPlaylists, ...customPlaylists],
    });
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { title } = body;

        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }

        const { data: playlist, error } = await supabase
            .from('playlists')
            .insert({
                user_id: user.id,
                title,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating playlist:', error);
            return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 });
        }

        return NextResponse.json({ playlist });
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
