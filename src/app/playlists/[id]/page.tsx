"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Heart, Ban, ChevronLeft, Play, Pause, Music } from "lucide-react";

import { Layout } from "@/components/Layout";

type Track = {
  track_id: string;
  type: "track";
  track_name: string;
  artist_name: string;
  artwork_url: string;
  preview_url: string;
};

export default function PlaylistDetailPage() {
  const { id } = useParams();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();

  const playlistMeta =
    id === "likes"
      ? {
          name: "お気に入り",
          icon: <Heart className="h-6 w-6 text-red-500 fill-current" />,
        }
      : {
          name: "スキップ済み",
          icon: <Ban className="h-6 w-6 text-zinc-400" />,
        };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/playlists/${id}`);

        if (process.env.NODE_ENV === "development") {
          console.log("=== Playlist Detail Fetch ===");
          console.log("Status:", res.status);
          console.log("OK:", res.ok);
        }

        if (res.status === 401 || res.status === 403) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          console.error("Fetch error:", res.status);
          setLoading(false);
          return;
        }

        const responseData = await res.json();

        if (process.env.NODE_ENV === "development") {
          console.log("Response data:", responseData);
          console.log("Tracks:", responseData.tracks);
          console.log("Tracks length:", responseData.tracks?.length);
        }

        setTracks(responseData.tracks || []);
      } catch (err) {
        console.error("Network error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // ページ離脱時に音声を停止とリスナーをクリア
    return () => {
      if (audioRef.current) {
        // リスナーを削除
        audioRef.current.onended = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [id, router]);

  const handlePlay = (track: Track) => {
    if (playingId === track.track_id) {
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.pause();
      }
      setPlayingId(null);
    } else {
      // 古いオーディオのリスナーを削除
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.pause();
      }

      // 新しいオーディオを作成
      audioRef.current = new Audio(track.preview_url);
      audioRef.current.onended = () => setPlayingId(null);
      audioRef.current.play();
      setPlayingId(track.track_id);
    }
  };

  if (loading)
    return (
      <Layout>
        <div className="bg-black text-white flex items-center justify-center">
          読み込み中...
        </div>
      </Layout>
    );

  return (
    <Layout>
      <div className="min-h-full bg-zinc-950 text-white p-6 pb-24">
        <div className="w-full max-w-3xl mx-auto">
          <header className="mb-8">
            <div className="flex items-center gap-4 mb-6">
              <button
                type="button"
                onClick={() => router.push("/playlists")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all active:scale-90"
                aria-label="戻る"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900">
                  {playlistMeta.icon}
                </div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {playlistMeta.name}
                </h1>
              </div>
            </div>

            <Link
              href={`/playlists/${id}/swipe`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all active:scale-[0.98] shadow-lg shadow-blue-900/20"
            >
              <Play className="h-4 w-4 fill-current" />
              スワイプで再評価
            </Link>
          </header>

          {tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
              <Music className="h-12 w-12 mb-4 opacity-20" />
              <p>曲がありません</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="track-list">
              {tracks.map((track) => (
                <button
                  key={track.track_id}
                  type="button"
                  onClick={() => handlePlay(track)}
                  className={`group flex items-center gap-4 w-full p-2 rounded-xl transition-all active:scale-[0.99] ${
                    playingId === track.track_id
                      ? "bg-white/10"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                    <Image
                      src={track.artwork_url}
                      alt={track.track_name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                    {playingId === track.track_id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                        <Pause className="h-6 w-6 text-white fill-current" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p
                      className={`font-medium truncate ${
                        playingId === track.track_id
                          ? "text-blue-400"
                          : "text-white"
                      }`}
                    >
                      {track.track_name}
                    </p>
                    <p className="text-sm text-zinc-400 truncate">
                      {track.artist_name}
                    </p>
                  </div>
                  {playingId !== track.track_id && (
                    <Play className="h-5 w-5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
