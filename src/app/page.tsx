"use client";

import { useQuery } from "@tanstack/react-query";

import { Layout } from "@/components/Layout";
import { TrackCardStack } from "@/components/TrackCardStack";
import { fetchRandomTracks } from "@/lib/api/tracks";

const TRACKS_COUNT = 10;

export default function Home() {
  const {
    data: tracks,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["tracks", "random", TRACKS_COUNT],
    queryFn: () => fetchRandomTracks(TRACKS_COUNT),
  });

  const renderContent = () => {
    if (isLoading) {
      return (
        <div
          className="glass flex h-[min(110vw,440px)] w-[min(85vw,340px)] items-center justify-center rounded-3xl border border-white/10 bg-white/5"
          role="status"
          aria-live="polite"
        >
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span className="sr-only">読み込み中</span>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="glass w-[min(85vw,340px)] rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <p className="text-lg font-bold text-red-400">エラーが発生しました</p>
          <p className="mt-2 text-sm text-red-400/60">
            {error instanceof Error ? error.message : "Failed to load tracks"}
          </p>
        </div>
      );
    }

    if (!tracks || tracks.length === 0) {
      return (
        <div className="glass flex h-[min(110vw,440px)] w-[min(85vw,340px)] items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-foreground">
          <p className="text-sm font-medium opacity-60">
            楽曲が見つかりませんでした
          </p>
        </div>
      );
    }

    return <TrackCardStack tracks={tracks} />;
  };

  return (
    <Layout>
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center bg-background text-foreground">
        <main className="flex w-full flex-col items-center gap-8 py-8">
          <header className="w-[min(85vw,340px)]">
            <div className="space-y-1">
              <h1 className="bg-gradient-to-br from-white to-white/60 bg-clip-text text-3xl font-black tracking-tight text-transparent">
                Discovery
              </h1>
              <p className="text-xs font-medium tracking-wider text-white/40 uppercase">
                Swipe to explore new music
              </p>
            </div>
          </header>

          {renderContent()}
        </main>
      </div>
    </Layout>
  );
}
