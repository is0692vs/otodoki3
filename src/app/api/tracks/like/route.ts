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

    // Rate limit by user id (fallback to ip if needed)
    const rlKey = `likes:${user.id}`;
    const rl = rateLimit(rlKey, 120, 60_000);
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Dislikeがあれば削除 (check error)
    const { error: deleteError } = await supabase
        .from('dislikes')
        .delete()
        .eq('user_id', user.id)
        .eq('track_id', normalizedTrackId);

    if (deleteError) {
        console.error('Failed to remove existing dislike', { error: deleteError, userId: user.id, trackId: normalizedTrackId });
        // Do not proceed if delete fails - surface the error
        return NextResponse.json({ error: 'Failed to remove existing dislike' }, { status: 500 });
    }

    // Likeをupsert（既存なら created_at 更新）
    const { error } = await supabase
        .from('likes')
        .upsert(
            { user_id: user.id, track_id: normalizedTrackId, created_at: new Date().toISOString() },
            { onConflict: 'user_id,track_id' }
        );

    if (error) {
        console.error('Like error:', { error, userId: user.id, trackId: normalizedTrackId });
        return NextResponse.json({ error: 'Failed to save like' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
