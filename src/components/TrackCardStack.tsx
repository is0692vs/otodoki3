"use client";

import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, X, Music, Sparkles } from "lucide-react";

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
 * @param mode - 'discover' (デフォルト) または 'playlist'。プレイリストモードでは補充なし・チュートリアルなし。
 * @param sourcePlaylist - プレイリストモードで、元のプレイリストID（'likes' or 'dislikes'）。TODO: 将来のプレイリスト間移動機能で使用予定。
 * @returns コンポーネントのレンダリング結果（React 要素）
 */
export function TrackCardStack({
  tracks,
  mode = "discover",
}: {
  tracks: Track[];
  mode?: "discover" | "playlist";
  sourcePlaylist?: string;
}) {
  // ライブラリ選定理由:
  // - react-tinder-card は peerDependencies が react@^16.8 || ^17 || ^18 までで、react@19 と依存解決が衝突する可能性が高い
  // - framer-motion は react@^18 || ^19 をサポートしており、このリポジトリ(react 19)で安全に導入できる

  const initialStack: CardItem[] = [
    { type: "tutorial", id: "tutorial-1" },
    ...tracks,
  ];

  const [stack, setStack] = useState<CardItem[]>(initialStack);
  const { play, stop, pause, resume, isPlaying, progress, preload } =
    useAudioPlayer();
  const hasUserInteractedRef = useRef(false);
  const cardRefs = useRef<Map<string, SwipeableCardRef>>(new Map());
  const lastPlayedUrlRef = useRef<string | null>(null);

  // 音声再生ヘルパー: URL の重複チェックと再生開始を一箇所に集約
  const playTrack = useCallback(
    (url: string) => {
      play(url);
      lastPlayedUrlRef.current = url;
    },
    [play]
  );

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

  const { isRefilling, error, clearError } = useAutoRefill(
    stack,
    handleRefill,
    mode === "playlist" // プレイリストモードでは補充無効化
  );

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

    // すでに再生指示済みのURLならスキップ（swipeTopでの先行再生との重複防止）
    if (lastPlayedUrlRef.current === top.preview_url) return;

    playTrack(top.preview_url);
    // NOTE: We intentionally use stack[0] (complex expression) instead of stack to avoid re-running
    // this effect on every stack change. We only want to run when the top card changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack[0], play]);

  useEffect(() => {
    const nextCard = stack[1];
    if (!nextCard || !("track_id" in nextCard) || !nextCard.preview_url) return;

    preload(nextCard.preview_url);
    // NOTE: We intentionally depend on stack[0] (top card) rather than stack,
    // to avoid re-running on every stack mutation. We only want to preload when
    // the top card changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack[0], preload]);

  const swipeTop = (direction: SwipeDirection, item: CardItem) => {
    // ユーザージェスチャー内で同期的に停止（自動再生ポリシー対策）
    stop();

    // 初回スワイプでフラグをON
    hasUserInteractedRef.current = true;

    // 次のカードを取得
    const nextCard = stack[1];

    // ユーザージェスチャーのコンテキスト内で同期的に play() を開始
    if (nextCard && "track_id" in nextCard && nextCard.preview_url) {
      playTrack(nextCard.preview_url);
    }

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
          // toast.push({ type: "success", message: "スキップを保存しました" }); // 通知を削除
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
          playTrack(top.preview_url);
        }
      }
    }
  };

  const handleDislikeClick = () => {
    hasUserInteractedRef.current = true;
    const top = stack[0];
    if (!top) return;
    const key =
      "type" in top && top.type === "tutorial" ? top.id : top.track_id;
    cardRefs.current.get(key)?.swipeLeft();
  };

  const handleLikeClick = () => {
    hasUserInteractedRef.current = true;
    const top = stack[0];
    if (!top) return;
    const key =
      "type" in top && top.type === "tutorial" ? top.id : top.track_id;
    cardRefs.current.get(key)?.swipeRight();
  };

  if (stack.length === 0) {
    const emptyMessage =
      mode === "playlist" ? (
        <span className="flex items-center gap-2">
          すべての曲を評価しました <Sparkles className="h-4 w-4" />
        </span>
      ) : (
        <span className="flex items-center gap-2">
          今日のディスカバリーはここまで <Music className="h-4 w-4" />
        </span>
      );

    return (
      <div className="flex flex-col items-center gap-8">
        <div className="glass flex h-[min(85vw,340px)] w-[min(85vw,340px)] items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-foreground">
          <p className="text-sm font-medium opacity-60">{emptyMessage}</p>
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
            className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-500/90 px-6 py-3 text-sm font-medium text-white shadow-lg backdrop-blur-md md:bottom-8"
          >
            補充に失敗しました
            <button
              type="button"
              onClick={() => clearError()}
              className="ml-2 rounded-full p-1 hover:bg-white/20"
              aria-label="エラーを閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* エラーがない時のみローディング表示 */}
        {!error && isRefilling && (
          <div
            role="status"
            className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white/10 px-6 py-3 text-sm font-medium text-white shadow-lg backdrop-blur-md md:bottom-8"
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
              const key =
                "type" in item && item.type === "tutorial"
                  ? item.id
                  : item.track_id;

              return (
                <SwipeableCard
                  key={key}
                  ref={(node) => {
                    if (node) {
                      cardRefs.current.set(key, node);
                    } else {
                      cardRefs.current.delete(key);
                    }
                  }}
                  item={item}
                  isTop={isTop}
                  index={index}
                  onSwipe={swipeTop}
                  isPlaying={isTop && isTrack ? isPlaying : undefined}
                  onPlayPause={
                    isTop && isTrack ? handlePlayPauseClick : undefined
                  }
                  progress={isTop && isTrack ? progress : undefined}
                  tutorialMode={mode}
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Like/Dislikeボタン - カードの外側（下）に配置 */}
      <div className="flex items-center justify-center gap-12">
        <button
          type="button"
          onClick={handleDislikeClick}
          disabled={actionInProgress}
          className={`group flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white shadow-xl backdrop-blur-md transition-all duration-300 hover:bg-white/10 hover:scale-110 active:scale-90 ${
            actionInProgress ? "opacity-50 cursor-not-allowed" : ""
          }`}
          aria-label="よくない"
        >
          <X className="h-10 w-10 transition-transform group-hover:rotate-90" />
        </button>

        <button
          type="button"
          onClick={handleLikeClick}
          disabled={actionInProgress}
          className={`group flex h-20 w-20 items-center justify-center rounded-full border border-blue-500/30 bg-blue-600/20 text-blue-400 shadow-xl backdrop-blur-md transition-all duration-300 hover:bg-blue-600/30 hover:scale-110 active:scale-90 ${
            actionInProgress ? "opacity-50 cursor-not-allowed" : ""
          }`}
          aria-label="いいね"
        >
          <Heart className="h-10 w-10 transition-transform group-hover:scale-125 fill-current" />
        </button>
      </div>
    </div>
  );
}
