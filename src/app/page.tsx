"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
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

  // Supabaseクライアントをコンポーネントライフサイクル全体で再利用
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      setIsSigningOut(false);
      alert("ログアウトに失敗しました。再度お試しください。");
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div
          className="flex h-[70vh] max-h-140 w-[92vw] max-w-sm items-center justify-center rounded-3xl border border-black/8 bg-background dark:border-white/15"
          role="status"
          aria-live="polite"
        >
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          <span className="sr-only">読み込み中</span>
        </div>
      );
    }

    if (isError) {
      return (
        <div className="w-[92vw] max-w-sm rounded-2xl border border-black/8 bg-background p-4 text-sm dark:border-white/15">
          <p className="font-semibold">エラー</p>
          <p className="mt-1 opacity-80">
            {error instanceof Error ? error.message : "Failed"}
          </p>
        </div>
      );
    }

    if (!tracks || tracks.length === 0) {
      return (
        <div className="flex h-[70vh] max-h-140 w-[92vw] max-w-sm items-center justify-center rounded-3xl border border-black/8 bg-background text-foreground dark:border-white/15">
          <p className="text-sm opacity-80">楽曲がありません</p>
        </div>
      );
    }

    return <TrackCardStack tracks={tracks} />;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <main className="flex w-full flex-col items-center gap-6 py-10">
        <header className="w-[92vw] max-w-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">ディスカバリー</h1>
              <p className="mt-1 text-sm opacity-70">
                右スワイプ: Like / 左スワイプ: Skip
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="rounded-full border border-red-200 px-3 py-1 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              {isSigningOut ? "サインアウト中…" : "ログアウト"}
            </button>
          </div>
        </header>

        {renderContent()}
      </main>
    </div>
  );
}
