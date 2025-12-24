import type { Track } from "../types/track-pool";
import Image from "next/image";

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

export function TrackCard({ track }: { track: Track }) {
  const artworkUrl = isValidArtworkUrl(track.artwork_url)
    ? track.artwork_url.trim()
    : undefined;
  const backgroundImage = artworkUrl ? `url(${artworkUrl})` : undefined;

  return (
    <article
      className="relative h-full w-full overflow-hidden rounded-3xl bg-background text-foreground"
      aria-label={`${track.track_name} - ${track.artist_name}`}
      style={
        backgroundImage
          ? {
              backgroundImage,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {!backgroundImage ? (
        <div className="absolute inset-0 bg-zinc-200 dark:bg-zinc-900" />
      ) : null}

      {/* Apple Musicボタン (右上) */}
      {track.track_view_url ? (
        <a
          href={track.track_view_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Apple Musicで開く"
          className="absolute right-4 top-4 z-10 inline-flex items-center rounded-full bg-black/50 p-2 backdrop-blur-sm transition-all hover:bg-black/70"
        >
          <Image
            src="/apple-music-badge.svg"
            alt="Apple Music"
            className="h-6 w-auto"
            width={180}
            height={40}
          />
        </a>
      ) : null}

      <div className="absolute inset-x-0 bottom-0">
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent" />
        <div className="relative p-5 text-white">
          <h3 className="text-2xl font-bold leading-tight">
            {track.track_name}
          </h3>
          <p className="mt-1 text-base opacity-90">{track.artist_name}</p>
        </div>
      </div>
    </article>
  );
}
