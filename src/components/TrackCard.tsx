import type { Track } from "../types/track-pool";
import Image from "next/image";
import { AudioProgressBar } from "./AudioProgressBar";

function isValidArtworkUrl(url: string | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function TrackCard({
  track,
  progress,
}: {
  track: Track;
  progress?: number;
}) {
  const artworkUrl = isValidArtworkUrl(track.artwork_url)
    ? track.artwork_url.trim()
    : undefined;

  return (
    <article
      className="flex h-full w-full flex-col overflow-hidden rounded-3xl bg-zinc-900 text-white shadow-xl"
      aria-label={`${track.track_name} - ${track.artist_name}`}
    >
      {/* 画像エリア (正方形) */}
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-800">
        {artworkUrl ? (
          <Image
            src={artworkUrl}
            alt=""
            fill
            className="object-cover select-none [-webkit-user-drag:none]"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            unoptimized
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          >
            <span className="text-4xl opacity-20">🎵</span>
          </div>
        )}

        {/* Apple Musicボタン (画像の上にオーバーレイ) */}
        {track.track_view_url ? (
          <a
            href={track.track_view_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Apple Musicで開く"
            className="absolute right-3 bottom-3 z-10 inline-flex items-center rounded-full bg-black/40 p-2 backdrop-blur-md transition-all hover:bg-black/60"
          >
            <Image
              src="/apple-music-badge.svg"
              alt="Apple Music"
              className="h-5 w-auto select-none [-webkit-user-drag:none]"
              width={100}
              height={22}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
            />
          </a>
        ) : null}
      </div>

      {/* 再生位置バー */}
      {progress !== undefined && <AudioProgressBar progress={progress} />}

      {/* 情報エリア (余白部分) */}
      <div className="flex flex-1 flex-col justify-center px-5 py-2">
        <h3 className="line-clamp-2 text-lg font-bold leading-tight">
          {track.track_name}
        </h3>
        <p className="mt-1 line-clamp-1 text-sm text-zinc-400">
          {track.artist_name}
        </p>
      </div>
    </article>
  );
}
