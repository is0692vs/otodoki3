"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import type { Track, CardItem } from "../types/track-pool";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { SwipeableCard } from "./SwipeableCard";
import { AudioProgressBar } from "./AudioProgressBar";

type SwipeDirection = "left" | "right";

export function TrackCardStack({ tracks }: { tracks: Track[] }) {
  // ライブラリ選定理由:
  // - react-tinder-card は peerDependencies が react@^16.8 || ^17 || ^18 までで、react@19 と依存解決が衝突する可能性が高い
  // - framer-motion は react@^18 || ^19 をサポートしており、このリポジトリ(react 19)で安全に導入できる

  const initialStack: CardItem[] = [
    { type: "tutorial", id: "tutorial-1" },
    ...tracks,
  ];

  const [stack, setStack] = useState<CardItem[]>(initialStack);
  const { play, stop, pause, resume, isPlaying, progress } = useAudioPlayer();
  const hasUserInteractedRef = useRef(false);

  useEffect(() => {
    setStack((prev) => (prev.length === 0 ? initialStack : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks]);

  useEffect(() => {
    const top = stack[0];
    if (!top) return;

    // チュートリアルカードなら再生しない（音源がない）
    if ("type" in top && top.type === "tutorial") {
      return;
    }

    // 楽曲カードの場合のみ処理
    if (!("track_id" in top)) return;
    if (!top.preview_url) return;

    // 初回インタラクション前は再生しない（自動再生ポリシー対策）
    if (!hasUserInteractedRef.current) return;

    play(top.preview_url);
    // 指示: 依存配列は track_id のみ（ジェスチャー起点を維持したい）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack[0]?.type === "track" ? stack[0].track_id : stack[0]?.id]);

  const swipeTop = (direction: SwipeDirection, item: CardItem) => {
    // ユーザージェスチャー内で同期的に停止（自動再生ポリシー対策）
    stop();

    // 初回スワイプでフラグをON
    hasUserInteractedRef.current = true;

    // チュートリアルカード判定
    if ("type" in item && item.type === "tutorial") {
      console.log("Tutorial swiped", direction);
      setStack((prev) => prev.slice(1));
      return;
    }

    // 楽曲カード処理
    const track = item as Track;
    if (direction === "right") {
      console.log("Like", track.track_id);
    } else {
      console.log("Skip", track.track_id);
    }

    setStack((prev) => {
      if (prev.length === 0) return prev;
      const top = prev[0];
      if (
        "track_id" in top &&
        "track_id" in track &&
        top.track_id === track.track_id
      ) {
        return prev.slice(1);
      }
      return prev.filter(
        (t) =>
          !(
            "track_id" in t &&
            "track_id" in track &&
            t.track_id === track.track_id
          )
      );
    });
  };

  const handlePlayPauseClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    // 初回インタラクション時のフラグをON
    hasUserInteractedRef.current = true;

    if (isPlaying) {
      pause();
    } else {
      // 再生中でない場合、最上位カードの曲を再生（または再開）
      const top = stack[0];
      if (!top) return;

      // チュートリアルカードの場合はスキップ
      if ("type" in top && top.type === "tutorial") return;

      // 楽曲カードの場合、preview_urlがあれば再生または再開
      if ("track_id" in top && top.preview_url) {
        // progress > 0 で判定して resume()/play() を分岐
        if (progress > 0) {
          resume();
        } else {
          play(top.preview_url);
        }
      }
    }
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
      <div className="absolute inset-x-0 bottom-0 z-200">
        <AudioProgressBar progress={progress} />
      </div>
      <AnimatePresence initial={false}>
        {stack.map((item, index) => {
          const isTop = index === 0;

          return (
            <SwipeableCard
              key={
                "type" in item && item.type === "tutorial"
                  ? item.id
                  : item.track_id
              }
              item={item}
              isTop={isTop}
              index={index}
              onSwipe={swipeTop}
              isPlaying={isTop ? isPlaying : undefined}
              onPlayPause={isTop ? handlePlayPauseClick : undefined}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}
