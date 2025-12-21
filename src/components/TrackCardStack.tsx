"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

import type { Track } from "../types/track-pool";
import { TrackCard } from "./TrackCard";

type SwipeDirection = "left" | "right";

const SWIPE_THRESHOLD_PX = 110;
const EXIT_X_OFFSET = 600;
const EXIT_ROTATION_DEG = 10;
const EXIT_DURATION = 0.18;

export function TrackCardStack({ tracks }: { tracks: Track[] }) {
  // ライブラリ選定理由:
  // - react-tinder-card は peerDependencies が react@^16.8 || ^17 || ^18 までで、react@19 と依存解決が衝突する可能性が高い
  // - framer-motion は react@^18 || ^19 をサポートしており、このリポジトリ(react 19)で安全に導入できる

  const [stack, setStack] = useState<Track[]>(tracks);
  const [lastSwipe, setLastSwipe] = useState<SwipeDirection>("left");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStack((prev) => (prev.length === 0 ? tracks : prev));
  }, [tracks]);

  const zIndexFor = useCallback(
    (index: number) => stack.length - index,
    [stack.length]
  );

  const swipeTop = (direction: SwipeDirection) => {
    const current = stack[0];
    if (!current) return;

    setLastSwipe(direction);

    if (direction === "right") {
      console.log("Like", current.track_id);
    } else {
      console.log("Skip", current.track_id);
    }

    setStack((prev) => prev.slice(1));
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
            <motion.div
              key={track.track_id}
              className="absolute inset-0"
              style={{ zIndex: zIndexFor(index) }}
              drag={isTop ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              whileDrag={{ rotate: isTop ? 3 : 0 }}
              onDragEnd={(_, info) => {
                if (!isTop) return;

                if (info.offset.x > SWIPE_THRESHOLD_PX) {
                  swipeTop("right");
                  return;
                }

                if (info.offset.x < -SWIPE_THRESHOLD_PX) {
                  swipeTop("left");
                }
              }}
              initial={{ scale: 1, y: index * 3 }}
              animate={{ scale: 1, y: index * 3 }}
              exit={{
                x: lastSwipe === "right" ? EXIT_X_OFFSET : -EXIT_X_OFFSET,
                rotate: lastSwipe === "right" ? EXIT_ROTATION_DEG : -EXIT_ROTATION_DEG,
                opacity: 0,
                transition: { duration: EXIT_DURATION },
              }}
            >
              <TrackCard track={track} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
