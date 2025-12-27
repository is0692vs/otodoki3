import type { Track } from "@/types/track-pool";

export async function fetchRandomTracks(count: number): Promise<Track[]> {
  const res = await fetch(`/api/tracks/random?count=${count}`);

  const contentType = res.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await res.text();
    console.error("Expected JSON but received:", text.substring(0, 100));
    throw new Error(
      "サーバーから予期しないレスポンス（HTML）が返されました。ログイン状態を確認してください。"
    );
  }

  const json = (await res.json()) as
    | { success: true; tracks: Track[] }
    | { success: false; error: string };

  if (!res.ok || !json.success) {
    const message = "error" in json ? json.error : "Failed to fetch tracks";
    throw new Error(message);
  }

  return json.tracks;
}
