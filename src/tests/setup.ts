import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const createTestClient = () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL_TEST;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST;

    if (!url || !key) {
        throw new Error('Missing Supabase test credentials. Run `vercel env pull` to get test environment variables.');
    }

    return createClient<Database>(url, key);
};

export const cleanupTestData = async (trackIds: string[]) => {
    if (trackIds.length === 0) return;
    const client = createTestClient();
    const { error } = await client
        .from('track_pool')
        .delete()
        .in('track_id', trackIds);
    if (error) {
        console.error('Cleanup error:', error);
    }
};
