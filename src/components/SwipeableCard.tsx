"use client";

import React from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  PanInfo,
  animate,
  AnimatePresence,
} from "framer-motion";
import { flushSync } from "react-dom";
import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { Heart, X, Play, Pause, Plus } from "lucide-react";
import type { CardItem } from "../types/track-pool";
import { TrackCard } from "./TrackCard";
import { TutorialCard } from "./TutorialCard";
import { AddToPlaylistModal } from "./AddToPlaylistModal";

const ROTATE_INPUT_RANGE_PX = 200;
const ROTATE_OUTPUT_RANGE_DEG = 15; // 30から15に変更（回転を緩やかに）

const OPACITY_INPUT_RANGE_PX: number[] = [-200, -150, 0, 150, 200];
const OPACITY_OUTPUT_RANGE: number[] = [0, 1, 1, 1, 0];

const SWIPE_THRESHOLD_SCREEN_WIDTH_RATIO = 0.25;
const VELOCITY_THRESHOLD_PX_PER_SEC = 200;

const EXIT_X_OFFSET_PX = 500;

const DRAG_ELASTIC = 0.2;
const WHILE_DRAG_SCALE = 1.05;

const STACK_Y_STEP_PX = 10;
const STACK_Y_CAP_PX = 30;

const EXIT_DURATION_SEC = 0.2;
const SNAP_BACK_SPRING = {
  type: "spring",
  stiffness: 350,
  damping: 30,
} as const;

export interface SwipeableCardRef {
  swipeLeft: () => void;
  swipeRight: () => void;
}

interface SwipeableCardProps {
  item: CardItem;
  isTop: boolean;
  onSwipe: (direction: "left" | "right", item: CardItem) => void;
  index: number;
  isPlaying?: boolean;
  onPlayPause?: (e?: React.MouseEvent) => void;
  progress?: number;
  tutorialMode?: "discover" | "playlist";
}

export const SwipeableCard = forwardRef<SwipeableCardRef, SwipeableCardProps>(
  function SwipeableCard(
    {
      item,
      isTop,
      onSwipe,
      index,
      isPlaying,
      onPlayPause,
      progress,
      tutorialMode,
    }: SwipeableCardProps,
    ref
  ) {
    const [exitX, setExitX] = useState<number | null>(null);
    const [showReaction, setShowReaction] = useState<"like" | "skip" | null>(
      null
    );
    const [isModalOpen, setIsModalOpen] = useState(false);
    const x = useMotionValue(0);
    const swipeTimeoutRef = useRef<number | null>(null);
    const isSwipingRef = useRef(false);
    const scheduleSwipeCompletion = useCallback(
      (direction: "left" | "right") => {
        if (swipeTimeoutRef.current !== null) {
          clearTimeout(swipeTimeoutRef.current);
        }
        swipeTimeoutRef.current = window.setTimeout(() => {
          onSwipe(direction, item);
          setShowReaction(null);
          isSwipingRef.current = false;
          swipeTimeoutRef.current = null;
        }, EXIT_DURATION_SEC * 1000);
      },
      [item, onSwipe]
    );

    useEffect(() => {
      return () => {
        if (swipeTimeoutRef.current !== null) {
          clearTimeout(swipeTimeoutRef.current);
        }
      };
    }, []);

    // 外部からスワイプをトリガーするためのAPI
    useImperativeHandle(
      ref,
      () => ({
        swipeLeft: () => {
          if (!isTop || isSwipingRef.current) return;
          isSwipingRef.current = true;

          // スワイプアニメーションを実行
          flushSync(() => {
            setExitX(-EXIT_X_OFFSET_PX);
            setShowReaction("skip");
          });

          // x座標をアニメーション
          animate(x, -EXIT_X_OFFSET_PX, {
            duration: EXIT_DURATION_SEC,
            ease: "easeOut",
          });

          scheduleSwipeCompletion("left");
        },
        swipeRight: () => {
          if (!isTop || isSwipingRef.current) return;
          isSwipingRef.current = true;

          // スワイプアニメーションを実行
          flushSync(() => {
            setExitX(EXIT_X_OFFSET_PX);
            setShowReaction("like");
          });

          // x座標をアニメーション
          animate(x, EXIT_X_OFFSET_PX, {
            duration: EXIT_DURATION_SEC,
            ease: "easeOut",
          });

          scheduleSwipeCompletion("right");
        },
      }),
      [isTop, item, onSwipe, scheduleSwipeCompletion, x]
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
      // Ignore when not top, already swiping, or key repeat to avoid multiple swipe attempts while a key is held
      if (!isTop || isSwipingRef.current || e.repeat) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        isSwipingRef.current = true;
        flushSync(() => {
          setExitX(-EXIT_X_OFFSET_PX);
          setShowReaction("skip");
        });
        scheduleSwipeCompletion("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        isSwipingRef.current = true;
        flushSync(() => {
          setExitX(EXIT_X_OFFSET_PX);
          setShowReaction("like");
        });
        scheduleSwipeCompletion("right");
      }
    };

    const rotate = useTransform(
      x,
      [-ROTATE_INPUT_RANGE_PX, ROTATE_INPUT_RANGE_PX],
      [-ROTATE_OUTPUT_RANGE_DEG, ROTATE_OUTPUT_RANGE_DEG]
    );
    const opacity = useTransform(
      x,
      OPACITY_INPUT_RANGE_PX,
      OPACITY_OUTPUT_RANGE
    );

    // While regular cards just stack, the top one is interactive
    const handleDragEnd = (
      event: MouseEvent | TouchEvent | PointerEvent,
      info: PanInfo
    ) => {
      if (!isTop) return;

      const offset = info.offset.x;
      const velocity = info.velocity.x;

      const screenWidth =
        typeof window !== "undefined" ? window.innerWidth : 375;
      const swipeThreshold = screenWidth * SWIPE_THRESHOLD_SCREEN_WIDTH_RATIO;

      const isRight = offset > 0;
      const isLeft = offset < 0;

      const swipedRight =
        isRight &&
        (offset > swipeThreshold || velocity > VELOCITY_THRESHOLD_PX_PER_SEC);
      const swipedLeft =
        isLeft &&
        (offset < -swipeThreshold || velocity < -VELOCITY_THRESHOLD_PX_PER_SEC);

      if (swipedRight) {
        isSwipingRef.current = true;
        flushSync(() => {
          setExitX(EXIT_X_OFFSET_PX);
          setShowReaction("like");
        });
        // アニメーション終了後にonSwipeを呼ぶ
        scheduleSwipeCompletion("right");
      } else if (swipedLeft) {
        isSwipingRef.current = true;
        flushSync(() => {
          setExitX(-EXIT_X_OFFSET_PX);
          setShowReaction("skip");
        });
        scheduleSwipeCompletion("left");
      } else {
        animate(x, 0, SNAP_BACK_SPRING);
        // Reset swipe lock immediately for snap-back; framer-motion handles the animation internally and no swipe callback/timeout is needed
        isSwipingRef.current = false;
      }
    };

    return (
      <motion.div
        className="absolute inset-0 border-none bg-transparent p-0"
        style={{
          zIndex: 10 - index, // Keep behind BottomNav(z-40)/Sidebar(z-30)
          x,
          rotate,
          opacity,
        }}
        drag={isTop ? "x" : false}
        dragElastic={DRAG_ELASTIC}
        onDragEnd={handleDragEnd}
        onKeyDown={handleKeyDown}
        whileDrag={{ scale: WHILE_DRAG_SCALE }}
        initial={{
          scale: isTop ? 1 : 0.95,
          y: isTop ? 0 : Math.min(index * STACK_Y_STEP_PX, STACK_Y_CAP_PX),
        }}
        animate={{
          scale: isTop ? 1 : 0.95,
          y: isTop ? 0 : Math.min(index * STACK_Y_STEP_PX, STACK_Y_CAP_PX),
        }}
        exit={{
          x: exitX ?? EXIT_X_OFFSET_PX,
          opacity: 0,
          transition: { duration: EXIT_DURATION_SEC },
        }}
        aria-label={
          item.type === "tutorial"
            ? "チュートリアルカードをスワイプ"
            : `${item.track_name} by ${item.artist_name}をスワイプ`
        }
        tabIndex={isTop ? 0 : -1}
      >
        {/* リアクションアイコンアニメーション */}
        <AnimatePresence>
          {showReaction && (
            <motion.div
              className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
              initial={{
                opacity: 0,
                scale: 0.5,
                rotate: showReaction === "like" ? 15 : -15,
              }}
              animate={{ opacity: 1, scale: 1.5, rotate: 0 }}
              exit={{ opacity: 0, scale: 2, filter: "blur(10px)" }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div
                className={`flex h-32 w-32 items-center justify-center rounded-full glass ${
                  showReaction === "like"
                    ? "bg-red-500/20 border-red-500/50"
                    : "bg-white/10 border-white/30"
                }`}
              >
                {showReaction === "like" ? (
                  <Heart
                    className="h-16 w-16 text-red-500 fill-current drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                    aria-label="いいね"
                  />
                ) : (
                  <X
                    className="h-16 w-16 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                    aria-label="よくない"
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {item.type === "tutorial" ? (
          <TutorialCard mode={tutorialMode} />
        ) : (
          <>
            <TrackCard track={item} progress={progress} />

            {/* プレイリスト追加ボタン (右上) */}
            {isTop && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(true);
                }}
                className="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all hover:bg-black/60 hover:scale-110 active:scale-95"
                aria-label="プレイリストに追加"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </>
        )}

        {/* 再生/停止ボタン (横幅中央) */}
        {isTop && onPlayPause && (
          <button
            type="button"
            onClick={(e) => onPlayPause(e)}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10"
            aria-label={isPlaying ? "一時停止" : "再生"}
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="flex h-20 w-20 items-center justify-center rounded-full glass bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              {isPlaying ? (
                <Pause
                  className="h-10 w-10 fill-current"
                  aria-label="一時停止"
                />
              ) : (
                <Play
                  className="h-10 w-10 fill-current ml-1"
                  aria-label="再生"
                />
              )}
            </motion.div>
          </button>
        )}

        {/* プレイリスト追加モーダル */}
        {"track_id" in item && (
          <AddToPlaylistModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            trackId={item.track_id}
          />
        )}
      </motion.div>
    );
  }
);
