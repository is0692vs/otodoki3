import type { Track } from "../types/track-pool";
import Image from "next/image";
import { AudioProgressBar } from "./AudioProgressBar";
import { Music } from "lucide-react";

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

interface TrackCardProps {
  track: Track;
  progress?: number;
}

export function TrackCard({ track, progress }: TrackCardProps) {
  const artworkUrl = isValidArtworkUrl(track.artwork_url)
    ? track.artwork_url.trim()
    : undefined;

  return (
    <article
      className="glass flex h-full w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 text-white shadow-2xl"
      aria-label={`${track.track_name} - ${track.artist_name}`}
    >
      {/* 画像エリア (正方形) */}
      <div className="relative aspect-square w-full overflow-hidden bg-white/5">
        {artworkUrl ? (
          <Image
            src={artworkUrl}
            alt={`${track.track_name} - ${track.artist_name}`}
            fill
            className="object-cover select-none [-webkit-user-drag:none]"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            unoptimized
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            role="presentation"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          >
            <Music className="h-12 w-12 opacity-20" />
          </div>
        )}

        {/* Apple Musicボタン (画像の上にオーバーレイ) */}
        {track.track_view_url ? (
          <a
            href={track.track_view_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Apple Musicで開く"
            className="absolute right-4 bottom-4 z-10 inline-flex items-center rounded-full bg-black/40 p-2.5 backdrop-blur-xl transition-all hover:bg-black/60 hover:scale-110 active:scale-95"
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
      <div className="flex flex-1 flex-col justify-center px-6 py-4">
        <h3 className="line-clamp-2 text-xl font-bold leading-tight tracking-tight">
          {track.track_name}
        </h3>
        <p className="mt-1 line-clamp-1 text-sm font-medium text-white/50">
          {track.artist_name}
        </p>
      </div>
    </article>
  );
}
