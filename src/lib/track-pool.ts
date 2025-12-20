import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { Track } from '@/types/track-pool';

/**
 * metadata を検証・正規化して JSON 型で返す。無効なら null を返す
 */
export function validateMetadata(metadata: unknown): Database['public']['Tables']['track_pool']['Insert']['metadata'] | null {
    if (metadata == null) return null;
    // 文字列の場合は JSON をパースしてみる
    if (typeof metadata === 'string') {
        try {
            const parsed = JSON.parse(metadata);
            return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as any) : null;
        } catch (_) {
            return null;
        }
    }
    if (typeof metadata === 'object' && !Array.isArray(metadata)) {
        return metadata as any;
    }
    return null;
}

// 環境変数からプールの最大サイズを取得（デフォルト: 10000）
const TRACK_POOL_MAX_SIZE = parseInt(
    process.env.TRACK_POOL_MAX_SIZE || '10000',
    10
);

/**
 * track_poolテーブルから指定数の楽曲を取得
 * @param count 取得する楽曲数
 * @returns Track配列
 */
export async function getTracksFromPool(count: number): Promise<Track[]> {
    try {
        const { data, error } = await supabase
            .from('track_pool')
            .select('*')
            .order('fetched_at', { ascending: true })
            .limit(count);

        if (error) {
            console.error('Error fetching tracks from pool:', error);
            throw new Error(`Failed to fetch tracks from pool: ${error.message}`);
        }

        if (!data) {
            return [];
        }

        // Database型からTrack型に変換
        return data.map((row) => ({
            track_id: row.track_id,
            track_name: row.track_name,
            artist_name: row.artist_name,
            collection_name: row.collection_name ?? undefined,
            preview_url: row.preview_url,
            artwork_url: row.artwork_url ?? undefined,
            track_view_url: row.track_view_url ?? undefined,
            genre: row.genre ?? undefined,
            release_date: row.release_date ?? undefined,
            metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : undefined,
        }));
    } catch (error) {
        console.error('Error in getTracksFromPool:', error);
        throw error;
    }
}

/**
 * 楽曲をプールに追加（track_idで重複排除、upsert）
 * @param tracks 追加する楽曲配列
 * @param options オプション（method, weight）
 */
export async function addTracksToPool(
    tracks: Track[],
    options?: { method: string; weight: number }
): Promise<void> {
    try {
        if (tracks.length === 0) {
            console.log('No tracks to add to pool.');
            return;
        }

        // Track型からDatabase Insert型に変換
        const insertData = tracks.map((track) => ({
            track_id: track.track_id,
            track_name: track.track_name,
            artist_name: track.artist_name,
            collection_name: track.collection_name ?? null,
            preview_url: track.preview_url,
            artwork_url: track.artwork_url ?? null,
            track_view_url: track.track_view_url ?? null,
            genre: track.genre ?? null,
            release_date: track.release_date ?? null,
            metadata: validateMetadata(track.metadata),
            fetched_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('track_pool')
            .upsert(insertData, {
                onConflict: 'track_id',
                ignoreDuplicates: false,
            });

        if (error) {
            console.error('Error adding tracks to pool:', error);
            throw new Error(`Failed to add tracks to pool: ${error.message}`);
        }

        console.log(
            `Successfully added ${tracks.length} tracks to pool${options ? ` (method: ${options.method}, weight: ${options.weight})` : ''
            }`
        );

        // プールサイズの上限管理
        await trimPool(TRACK_POOL_MAX_SIZE);
    } catch (error) {
        console.error('Error in addTracksToPool:', error);
        throw error;
    }
}

/**
 * 現在のプールサイズ（曲数）を取得
 * @returns プール内の楽曲数
 */
export async function getPoolSize(): Promise<number> {
    try {
        const { count, error } = await supabase
            .from('track_pool')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('Error getting pool size:', error);
            throw new Error(`Failed to get pool size: ${error.message}`);
        }

        return count ?? 0;
    } catch (error) {
        console.error('Error in getPoolSize:', error);
        throw error;
    }
}

/**
 * プールサイズが上限を超えた場合、fetched_atが古いものから削除
 * @param maxSize プールの最大サイズ
 */
export async function trimPool(maxSize: number): Promise<void> {
    try {
        // RPC を呼び出してアトミックに古い行を削除
        const rpcResult = await supabase.rpc('trim_track_pool', { max_size: maxSize });
        const { data, error } = rpcResult || {};

        if (error) {
            console.error('Error trimming track pool via RPC:', error);
            throw new Error(`Failed to trim track pool: ${error.message}`);
        }

        // data は [{ deleted_count: <number> }] のような形で返ることを想定
        const deletedCount = Array.isArray(data) && data.length > 0 && (data[0] as any).deleted_count != null
            ? Number((data[0] as any).deleted_count)
            : 0;

        if (deletedCount > 0) {
            console.log(`Successfully removed ${deletedCount} old tracks from pool via RPC.`);
        } else {
            console.log('No tracks needed removal after trim RPC.');
        }
    } catch (error) {
        console.error('Error in trimPool:', error);
        throw error;
    }
}
