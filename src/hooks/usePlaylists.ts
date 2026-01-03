import { useQuery } from "@tanstack/react-query";

export interface Playlist {
    id: string;
    name: string;
    icon: string;
    count: number;
    is_default?: boolean;
}

/**
 * サーバーの "/api/playlists" からプレイリスト一覧を取得する。
 *
 * @returns 取得した `Playlist` の配列。レスポンスに配列が含まれない場合は空配列を返す。
 * @throws `Error` - レスポンスが OK でない場合にスローされ、message は "Failed to fetch playlists"、`status` に HTTP ステータスコードが設定される可能性がある。
 */
async function fetchPlaylists(): Promise<Playlist[]> {
    const res = await fetch("/api/playlists");

    if (!res.ok) {
        const err = new Error("Failed to fetch playlists") as Error & {
            status?: number;
        };
        err.status = res.status;
        throw err;
    }

    const data = (await res.json()) as { playlists?: Playlist[] };
    return data.playlists ?? [];
}

/**
 * プレイリスト一覧を取得する React Query フックを提供する。
 *
 * @returns React Query のクエリ結果オブジェクト。成功時は `data` に `Playlist[]` を含み、ロード中やエラー状態を示すフィールド（`isLoading`, `isError` など）を持つ。
 */
export function usePlaylists() {
    return useQuery({
        queryKey: ["playlists"],
        queryFn: fetchPlaylists,
    });
}