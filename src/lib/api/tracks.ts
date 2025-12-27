import type { Track } from "@/types/track-pool";
import { parseJsonResponse } from "./utils";

export async function fetchRandomTracks(count: number): Promise<Track[]> {
  const res = await fetch(`/api/tracks/random?count=${count}`);

  const json = await parseJsonResponse<
    | { success: true; tracks: Track[] }
    | { success: false; error: string }
  >(res);

  if (!res.ok || !json.success) {
    const message = "error" in json ? json.error : "Failed to fetch tracks";
    throw new Error(message);
  }

  return json.tracks;
}
