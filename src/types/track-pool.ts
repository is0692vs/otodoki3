export type RefillTiming = 'ondemand' | 'cron';
export type RefillMethod = 'chart' | 'keyword' | 'random';

export interface RefillConfig {
    timing: RefillTiming;
    method: RefillMethod;
    weight: number;
}

export interface Track {
    track_id: string;
    track_name: string;
    artist_name: string;
    collection_name?: string;
    preview_url: string;
    artwork_url?: string;
    track_view_url?: string;
    genre?: string;
    release_date?: string;
    metadata?: Record<string, unknown>;
}
