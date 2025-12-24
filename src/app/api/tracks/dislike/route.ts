import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimiter';
import { validateAndNormalizeTrackId } from '@/lib/validation';

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateAndNormalizeTrackId(body);

    if (!validation.success) {
        return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const normalizedTrackId = String(validation.trackId);

    // Rate limit check
    const rlKey = `dislikes:${user.id}`;
    const rl = rateLimit(rlKey, 120, 60_000);
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Likeがあれば削除 (check error)
    const { error: deleteError } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('track_id', normalizedTrackId);

    if (deleteError) {
        console.error('Failed to remove existing like', { error: deleteError, userId: user.id, trackId: normalizedTrackId });
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
        console.error('Dislike error:', { error, userId: user.id, trackId: normalizedTrackId });
        return NextResponse.json({ error: 'Failed to save dislike' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
