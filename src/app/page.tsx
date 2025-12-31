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
          className="flex h-[min(110vw,440px)] w-[min(85vw,340px)] items-center justify-center rounded-3xl border border-border bg-secondary/50"
          role="status"
          aria-live="polite"
        >
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="sr-only">読み込み中</span>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="w-[min(85vw,340px)] rounded-3xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <p className="text-lg font-bold text-destructive">
            エラーが発生しました
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Failed to load tracks"}
          </p>
        </div>
      );
    }

    if (!tracks || tracks.length === 0) {
      return (
        <div className="flex h-[min(110vw,440px)] w-[min(85vw,340px)] items-center justify-center rounded-3xl border border-border bg-secondary/50 text-foreground">
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
              <h1 className="text-3xl font-black tracking-tight text-foreground">
                ディスカバリー
              </h1>
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                スワイプして新しい音楽を探す
              </p>
            </div>
          </header>

          {renderContent()}
        </main>
      </div>
    </Layout>
  );
}
