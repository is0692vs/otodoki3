import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimiter';

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { track_id } = body;

    if (track_id === undefined || track_id === null) {
        return NextResponse.json({ error: 'track_id is required' }, { status: 400 });
    }

    // validate/normalize track_id
    let normalizedTrackId: string;
    if (typeof track_id === 'number') {
        if (!Number.isSafeInteger(track_id)) {
            return NextResponse.json({ error: 'track_id must be a safe integer' }, { status: 400 });
        }
        normalizedTrackId = String(track_id);
    } else if (typeof track_id === 'string') {
        if (!/^\d+$/.test(track_id)) {
            return NextResponse.json({ error: 'track_id must be a numeric string' }, { status: 400 });
        }
        normalizedTrackId = track_id;
    } else {
        return NextResponse.json({ error: 'track_id must be a number or numeric string' }, { status: 400 });
    }

    // Rate limit check
    const rlKey = `dislikes:${user.id}`;
    const rl = rateLimit(rlKey, 30, 60_000);
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Likeがあれば削除 (check error)
    const delRes = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('track_id', normalizedTrackId);

    if ((delRes as any).error) {
        console.error('Failed to remove existing like', { error: (delRes as any).error, user: user.id, track_id: normalizedTrackId });
        return NextResponse.json({ error: 'Failed to remove existing like' }, { status: 500 });
    }

    // Dislikeをupsert（既存なら created_at 更新 = 30日延長）
    const { error } = await supabase
        .from('dislikes')
        .upsert(
            { user_id: user.id, track_id: normalizedTrackId, created_at: new Date().toISOString() },
            { onConflict: 'user_id,track_id' }
        );

    if (error) {
        console.error('Dislike error:', error, { user: user.id, track_id: normalizedTrackId });
        return NextResponse.json({ error: 'Failed to save dislike' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
