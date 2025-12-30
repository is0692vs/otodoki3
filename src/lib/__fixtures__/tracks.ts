import type { Track } from '@/types/track-pool';

/**
 * テスト用の固定トラックデータ
 */
export const mockTracks: Track[] = [
    {
        type: 'track',
        track_id: 1001,
        track_name: 'テスト曲1',
        artist_name: 'アーティスト1',
        collection_name: 'アルバム1',
        preview_url: 'https://example.com/preview1.m4a',
        artwork_url: 'https://example.com/artwork1.jpg',
        track_view_url: 'https://example.com/track1',
        genre: 'J-Pop',
        release_date: '2024-01-01',
        metadata: {
            source: 'test',
            test_data: true,
        },
    },
    {
        type: 'track',
        track_id: 1002,
        track_name: 'テスト曲2',
        artist_name: 'アーティスト2',
        preview_url: 'https://example.com/preview2.m4a',
        metadata: {
            source: 'test',
            test_data: true,
        },
    },
    {
        type: 'track',
        track_id: 1003,
        track_name: 'テスト曲3',
        artist_name: 'アーティスト3',
        collection_name: 'アルバム3',
        preview_url: 'https://example.com/preview3.m4a',
        artwork_url: 'https://example.com/artwork3.jpg',
        genre: 'Rock',
        metadata: {
            source: 'test',
            test_data: true,
        },
    },
];

/**
 * Apple RSS API のモックレスポンス
 */
export const mockAppleRssResponse = {
    feed: {
        results: [
            {
                id: '2001',
                name: 'チャート曲1',
                artistName: 'チャートアーティスト1',
                url: 'https://example.com/chart1',
                artworkUrl100: 'https://example.com/chart_art1.jpg',
            },
            {
                id: '2002',
                name: 'チャート曲2',
                artistName: 'チャートアーティスト2',
                url: 'https://example.com/chart2',
                artworkUrl100: 'https://example.com/chart_art2.jpg',
            },
            {
                id: '2003',
                name: 'チャート曲3',
                artistName: 'チャートアーティスト3',
                url: 'https://example.com/chart3',
                artworkUrl100: 'https://example.com/chart_art3.jpg',
            },
        ],
    },
};

/**
 * 空のApple RSS APIレスポンス
 */
export const mockEmptyAppleRssResponse = {
    feed: {
        results: [],
    },
};

/**
 * iTunes Search API のモックレスポンス
 */
export const mockItunesSearchResponses: Record<string, { results: { previewUrl: string }[] }> = {
    '2001': { results: [{ previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/chart1.m4a' }] },
    '2002': { results: [{ previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/chart2.m4a' }] },
    '2003': { results: [{ previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/chart3.m4a' }] },
};

/**
 * preview_urlがないApple RSS APIレスポンス
 */
export const mockAppleRssResponseWithoutPreview = {
    feed: {
        results: [
            {
                id: '3001',
                name: 'プレビュー無し曲',
                artistName: 'アーティスト',
                artworkUrl100: 'https://example.com/art.jpg',
                // urlがない
            },
        ],
    },
};
