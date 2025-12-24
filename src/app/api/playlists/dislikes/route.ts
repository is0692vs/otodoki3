import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type DislikeWithTrack = {
    track_id: string;
    created_at: string | null;
    track_pool: Array<{
        track_name: string;
        artist_name: string;
        artwork_url: string | null;
        preview_url: string;
    }> | null;
};

export async function GET() {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // dislikes と track_pool を JOIN
    const { data, error } = await supabase
        .from('dislikes')
        .select(`
            track_id,
            created_at,
            track_pool (
                track_name,
                artist_name,
                artwork_url,
                preview_url
            )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Failed to fetch dislikes:', error);
        return NextResponse.json({ error: 'Failed to fetch dislikes' }, { status: 500 });
    }

    // null track_pool を除外してフラット化
    const tracks = (data as unknown as DislikeWithTrack[])
        .filter(item => item.track_pool !== null && item.track_pool!.length > 0)
        .map(item => ({
            track_id: String(item.track_id),
            type: 'track' as const,
            track_name: item.track_pool![0].track_name,
            artist_name: item.track_pool![0].artist_name,
            artwork_url: item.track_pool![0].artwork_url,
            preview_url: item.track_pool![0].preview_url,
            created_at: item.created_at,
        }));

    return NextResponse.json({ tracks });
}
