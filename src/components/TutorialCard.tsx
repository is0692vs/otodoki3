"use client";

import { Music, RefreshCw, ArrowLeft, ArrowRight } from "lucide-react";

export function TutorialCard({
  mode = "discover",
}: {
  mode?: "discover" | "playlist";
}) {
  const isTutorial = mode === "discover";
  const title = isTutorial ? "Discovery" : "Review";
  const subtitle = isTutorial
    ? "新しい音楽を見つけよう"
    : "プレイリストを整理しよう";
  const leftText = "Skip";
  const rightText = "Like";
  const ctaText = "スワイプして開始";

  return (
    <article
      className="relative h-full w-full overflow-hidden rounded-3xl bg-zinc-900 text-white shadow-2xl"
      aria-label="チュートリアルカード"
    >
      {/* 背景の装飾的なグラデーション */}
      <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-indigo-600/20 blur-3xl" />

      <div className="relative flex h-full flex-col items-center justify-between p-8 text-center">
        <div className="mt-12">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl mb-6">
            {isTutorial ? (
              <Music className="h-10 w-10 text-blue-400" />
            ) : (
              <RefreshCw className="h-10 w-10 text-indigo-400" />
            )}
          </div>
          <h2 className="text-4xl font-black tracking-tighter uppercase italic">
            {title}
          </h2>
          <p className="mt-2 text-zinc-400 font-medium">{subtitle}</p>
        </div>

        {/* スワイプガイド - より視覚的に */}
        <div className="flex w-full items-center justify-around gap-4 px-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 border border-white/5 shadow-inner">
              <ArrowLeft className="h-6 w-6 text-zinc-500" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              {leftText}
            </p>
          </div>

          <div className="h-px flex-1 bg-linear-to-r from-transparent via-zinc-800 to-transparent" />

          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600/20 border border-blue-500/20 shadow-lg shadow-blue-900/20">
              <ArrowRight className="h-6 w-6 text-blue-400" />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
              {rightText}
            </p>
          </div>
        </div>

        <div className="mb-8">
          <div className="animate-bounce mb-2">
            <div className="h-1 w-12 bg-zinc-800 rounded-full mx-auto" />
          </div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-500">
            {ctaText}
          </p>
        </div>
      </div>
    </article>
  );
}
