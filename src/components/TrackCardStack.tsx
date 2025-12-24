"use client";

import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Track, CardItem } from "../types/track-pool";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useAutoRefill } from "../hooks/useAutoRefill";
import { SwipeableCard, SwipeableCardRef } from "./SwipeableCard";
import { useToast } from "./ToastProvider";

type SwipeDirection = "left" | "right";

const fetchWithTimeout = async (
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs = 5000
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
};

const fetchWithRetry = async (
  input: RequestInfo,
  init: RequestInit = {},
  attempts = 3,
  timeoutMs = 5000,
  baseDelay = 300
) => {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchWithTimeout(input, init, timeoutMs);
      if (!res.ok) {
        const text = await res.text().catch(() => "<no body>");
        const err = new Error(`HTTP ${res.status}: ${text}`);
        lastErr = err;
        if (res.status >= 500 && i < attempts - 1) {
          await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, i)));
          continue;
        }
        throw err;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw lastErr;
    }
  }
  // throw lastErr; // 到達不能コードを削除
};

/**
 * トラックカードのスタックを管理して表示するコンポーネント。
 *
 * スタックはチュートリアルカードを先頭にしたカード群（トラックカードを含む）を保持し、
 * 最上位カードのプレビュー再生、スワイプによる「いいね/スキップ」操作、補充（refill）と重複除外、
 * 再生進捗・補充中・エラー表示、ならびに画面下部のいいね/よくないボタンを提供します。
 * 自動再生はユーザーが初回インタラクションを行った後にのみ開始されます。
 *
 * @param tracks - 表示するトラックの配列（各要素は Track）。チュートリアルカードとともに初期スタックを構成します。
 * @returns コンポーネントのレンダリング結果（React 要素）
 */
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
  const topCardRef = useRef<SwipeableCardRef>(null);

  const handleRefill = useCallback((newTracks: CardItem[]) => {
    setStack((prev) => {
      // 既存のtrack_idを収集
      const existingIds = new Set(
        prev
          .filter((item): item is Track => "track_id" in item)
          .map((item) => item.track_id)
      );

      // 重複を除外
      const uniqueNewTracks = newTracks.filter((track) => {
        if ("track_id" in track) {
          return !existingIds.has(track.track_id);
        }
        return true; // チュートリアルカードはそのまま通す
      });

      console.log(
        `Added ${uniqueNewTracks.length} unique tracks (filtered ${
          newTracks.length - uniqueNewTracks.length
        } duplicates)`
      );

      return [...prev, ...uniqueNewTracks];
    });
  }, []);

  const { isRefilling, error, clearError } = useAutoRefill(stack, handleRefill);

  // Toast helper
  const toast = useToast();
  const [actionInProgress, setActionInProgress] = useState(false);

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

    // optimistic remove
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

    if (direction === "right") {
      // Like flow: optimistic removal, background retry with rollback on final failure
      console.log("Like", track.track_id);
      const id = String(track.track_id);
      (async () => {
        setActionInProgress(true);
        try {
          await fetchWithRetry(
            "/api/tracks/like",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ track_id: id }),
            },
            3,
            5000,
            300
          );
        } catch (err) {
          console.error("Failed to save like after retries", {
            track_id: id,
            error: err,
          });
          toast.push({ type: "error", message: "いいねの保存に失敗しました" });
          // rollback: reinsert item at top
          setStack((prev) => [track, ...prev]);
        } finally {
          setActionInProgress(false);
        }
      })();
    } else {
      // Dislike/Skip flow: await, show progress and retry up to 3 attempts total (initial + 2 retries)
      console.log("Skip", track.track_id);
      const id = String(track.track_id);
      (async () => {
        setActionInProgress(true);
        try {
          const pending = toast.push(
            { type: "info", message: "スキップを保存しています..." },
            10000
          );
          await fetchWithRetry(
            "/api/tracks/dislike",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ track_id: id }),
            },
            3,
            5000,
            300
          );
          toast.dismiss(pending);
          toast.push({ type: "success", message: "スキップを保存しました" });
        } catch (err) {
          console.error("Failed to save dislike after retries", {
            track_id: id,
            error: err,
          });
          toast.push({
            type: "error",
            message: "スキップの保存に失敗しました",
          });
          // rollback on final failure
          setStack((prev) => [track, ...prev]);
        } finally {
          setActionInProgress(false);
        }
      })();
    }
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

  const handleDislikeClick = () => {
    hasUserInteractedRef.current = true;
    topCardRef.current?.swipeLeft();
  };

  const handleLikeClick = () => {
    hasUserInteractedRef.current = true;
    topCardRef.current?.swipeRight();
  };

  if (stack.length === 0) {
    return (
      <div className="flex flex-col items-center gap-8">
        <div className="flex h-[min(85vw,340px)] w-[min(85vw,340px)] items-center justify-center rounded-3xl border border-black/8 bg-background text-foreground dark:border-white/15">
          <p className="text-sm opacity-80">
            今日のディスカバリーはここまで 🎵
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center gap-8">
      {/* カードスタック部分 */}
      <div className="relative h-[min(110vw,440px)] w-[min(85vw,340px)]">
        {/* エラー表示を優先 */}
        {error && (
          <div
            role="alert"
            className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-red-500/90 px-4 py-2 text-sm text-white"
          >
            補充に失敗しました
            <button
              type="button"
              onClick={() => clearError()}
              className="ml-2 text-white/80 hover:text-white"
              aria-label="エラーを閉じる"
            >
              ✕
            </button>
          </div>
        )}

        {/* エラーがない時のみローディング表示 */}
        {!error && isRefilling && (
          <div
            role="status"
            className="fixed bottom-4 right-4 rounded-full bg-black/80 px-4 py-2 text-sm text-white"
          >
            楽曲を補充中...
          </div>
        )}

        {/* カードスタック */}
        <div className="relative h-full">
          <AnimatePresence initial={false}>
            {stack.map((item, index) => {
              const isTop = index === 0;
              const isTrack = item.type === "track";

              return (
                <SwipeableCard
                  key={
                    "type" in item && item.type === "tutorial"
                      ? item.id
                      : item.track_id
                  }
                  ref={isTop ? topCardRef : null}
                  item={item}
                  isTop={isTop}
                  index={index}
                  onSwipe={swipeTop}
                  isPlaying={isTop && isTrack ? isPlaying : undefined}
                  onPlayPause={
                    isTop && isTrack ? handlePlayPauseClick : undefined
                  }
                  progress={isTop && isTrack ? progress : undefined}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Like/Dislikeボタン - カードの外側（下）に配置 */}
      <div className="flex items-center justify-center gap-8">
        <button
          type="button"
          onClick={handleDislikeClick}
          disabled={actionInProgress}
          className={`flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-transform active:scale-95 ${
            actionInProgress
              ? "opacity-50 cursor-not-allowed"
              : "hover:scale-110"
          }`}
          aria-label="よくない"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-8 w-8"
          >
            <path
              fillRule="evenodd"
              d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleLikeClick}
          disabled={actionInProgress}
          className={`flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform active:scale-95 ${
            actionInProgress
              ? "opacity-50 cursor-not-allowed"
              : "hover:scale-110"
          }`}
          aria-label="いいね"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-8 w-8"
          >
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
