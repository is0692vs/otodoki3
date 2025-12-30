export type RefillTiming = 'ondemand' | 'cron';
export type RefillMethod = 'chart' | 'keyword' | 'random';

export type Weight = number & { readonly __brand: 'Weight' };

export function createWeight(value: number): Weight {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
        throw new Error('Weight must be a number between 0.0 and 1.0');
    }
    return value as Weight;
}

export interface RefillConfig {
    timing: RefillTiming;
    method: RefillMethod;
    // 0.0 - 1.0 (use createWeight to construct safely)
    weight: Weight;
}

export interface Track {
    type: 'track';  // ← 追加
    track_id: number;
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

export interface TutorialCard {
    type: 'tutorial';
    id: string;
}

export type CardItem = Track | TutorialCard;
