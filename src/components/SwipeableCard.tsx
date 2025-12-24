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
} from "react";
import type { CardItem, Track } from "../types/track-pool";
import { TrackCard } from "./TrackCard";
import { TutorialCard } from "./TutorialCard";

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
}

export const SwipeableCard = forwardRef<SwipeableCardRef, SwipeableCardProps>(
  function SwipeableCard(
    { item, isTop, onSwipe, index, isPlaying, onPlayPause }: SwipeableCardProps,
    ref
  ) {
    const [exitX, setExitX] = useState<number | null>(null);
    const [showReaction, setShowReaction] = useState<"like" | "skip" | null>(
      null
    );
    const x = useMotionValue(0);
    const swipeTimeoutRef = useRef<number | null>(null);
    const isSwipingRef = useRef(false);

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

          // アニメーション完了後にコールバック呼び出し
          swipeTimeoutRef.current = window.setTimeout(() => {
            onSwipe("left", item);
            setShowReaction(null);
          }, EXIT_DURATION_SEC * 1000);
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

          // アニメーション完了後にコールバック呼び出し
          swipeTimeoutRef.current = window.setTimeout(() => {
            onSwipe("right", item);
            setShowReaction(null);
          }, EXIT_DURATION_SEC * 1000);
        },
      }),
      [isTop, item, onSwipe, x]
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!isTop) return;

      if (e.key === "ArrowLeft") {
        flushSync(() => {
          setExitX(-EXIT_X_OFFSET_PX);
          setShowReaction("skip");
        });
        swipeTimeoutRef.current = window.setTimeout(() => {
          onSwipe("left", item);
          setShowReaction(null);
        }, EXIT_DURATION_SEC * 1000);
      } else if (e.key === "ArrowRight") {
        flushSync(() => {
          setExitX(EXIT_X_OFFSET_PX);
          setShowReaction("like");
        });
        swipeTimeoutRef.current = window.setTimeout(() => {
          onSwipe("right", item);
          setShowReaction(null);
        }, EXIT_DURATION_SEC * 1000);
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
        flushSync(() => {
          setExitX(EXIT_X_OFFSET_PX);
          setShowReaction("like");
        });
        // アニメーション終了後にonSwipeを呼ぶ
        swipeTimeoutRef.current = window.setTimeout(() => {
          onSwipe("right", item);
          setShowReaction(null);
        }, EXIT_DURATION_SEC * 1000);
      } else if (swipedLeft) {
        flushSync(() => {
          setExitX(-EXIT_X_OFFSET_PX);
          setShowReaction("skip");
        });
        swipeTimeoutRef.current = window.setTimeout(() => {
          onSwipe("left", item);
          setShowReaction(null);
        }, EXIT_DURATION_SEC * 1000);
      } else {
        animate(x, 0, SNAP_BACK_SPRING);
      }
    };

    return (
      <motion.div
        className="absolute inset-0 border-none bg-transparent p-0"
        style={{
          zIndex: 100 - index, // Simple zIndex stack
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
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1.2 }}
              exit={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: EXIT_DURATION_SEC }}
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                {showReaction === "like" ? (
                  // いいねアイコン
                  <svg
                    aria-label="いいね"
                    role="img"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-14 w-14 text-red-500"
                  >
                    <title>いいね</title>
                    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                  </svg>
                ) : (
                  // スキップアイコン
                  <svg
                    aria-label="よくない"
                    role="img"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-14 w-14 text-gray-400"
                  >
                    <title>よくない</title>
                    <path
                      fillRule="evenodd"
                      d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {item.type === "tutorial" ? (
          <TutorialCard />
        ) : (
          <TrackCard track={item} />
        )}

        {/* 再生/停止ボタン (横幅中央) */}
        {isTop && onPlayPause && (
          <button
            type="button"
            onClick={(e) => onPlayPause(e)}
            className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center justify-center z-10"
            aria-label={isPlaying ? "一時停止" : "再生"}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-black/70 active:scale-95">
              {isPlaying ? (
                // 停止アイコン
                <svg
                  aria-label="一時停止"
                  role="img"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-8 w-8"
                >
                  <title>一時停止</title>
                  <path
                    fillRule="evenodd"
                    d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                // 再生アイコン
                <svg
                  aria-label="再生"
                  role="img"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-8 w-8"
                >
                  <title>再生</title>
                  <path
                    fillRule="evenodd"
                    d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
          </button>
        )}
      </motion.div>
    );
  }
);
