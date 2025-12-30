import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

type LikeWithTrack = {
    track_id: string;
    created_at: string | null;
    track_pool: {
        track_name: string;
        artist_name: string;
        artwork_url: string | null;
        preview_url: string;
    } | Array<{
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

    // likes と track_pool を JOIN
    const { data, error } = await supabase
        .from('likes')
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
        console.error('Failed to fetch likes:', error);
        return NextResponse.json({ error: 'Failed to fetch likes' }, { status: 500 });
    }

    // null track_pool を除外してフラット化
    const tracks = (data as unknown as LikeWithTrack[])
        .filter(item => item.track_pool !== null)
        .map(item => {
            const pool = Array.isArray(item.track_pool) ? item.track_pool[0] : item.track_pool;
            if (!pool) return null;
            return {
                track_id: Number(item.track_id),
                type: 'track' as const,
                track_name: pool.track_name,
                artist_name: pool.artist_name,
                artwork_url: pool.artwork_url,
                preview_url: pool.preview_url,
                created_at: item.created_at,
            };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);

    return NextResponse.json({ tracks });
}
