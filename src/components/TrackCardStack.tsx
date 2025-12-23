"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

import type { Track } from "../types/track-pool";
import { SwipeableCard } from "./SwipeableCard";

type SwipeDirection = "left" | "right";

export function TrackCardStack({ tracks }: { tracks: Track[] }) {
  // ライブラリ選定理由:
  // - react-tinder-card は peerDependencies が react@^16.8 || ^17 || ^18 までで、react@19 と依存解決が衝突する可能性が高い
  // - framer-motion は react@^18 || ^19 をサポートしており、このリポジトリ(react 19)で安全に導入できる

  const [stack, setStack] = useState<Track[]>(tracks);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStack((prev) => (prev.length === 0 ? tracks : prev));
  }, [tracks]);

  const swipeTop = (direction: SwipeDirection, track: Track) => {
    if (direction === "right") {
      console.log("Like", track.track_id);
    } else {
      console.log("Skip", track.track_id);
    }

    setStack((prev) => {
      if (prev.length === 0) return prev;
      if (prev[0]?.track_id === track.track_id) return prev.slice(1);
      return prev.filter((t) => t.track_id !== track.track_id);
    });
  };

  if (stack.length === 0) {
    return (
      <div className="flex h-[70vh] max-h-140 w-[92vw] max-w-sm items-center justify-center rounded-3xl border border-black/8 bg-background text-foreground dark:border-white/15">
        <p className="text-sm opacity-80">今日のディスカバリーはここまで 🎵</p>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh] max-h-140 w-[92vw] max-w-sm">
      <AnimatePresence initial={false}>
        {stack.map((track, index) => {
          const isTop = index === 0;

          return (
            <SwipeableCard
              key={track.track_id}
              track={track}
              isTop={isTop}
              index={index}
              onSwipe={swipeTop}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
