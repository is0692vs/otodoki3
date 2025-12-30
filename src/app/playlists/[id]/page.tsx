"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  Ban,
  ChevronLeft,
  Play,
  Pause,
  Music,
  Plus,
} from "lucide-react";

import { Layout } from "@/components/Layout";
import { SelectTrackModal } from "@/components/SelectTrackModal";

type Track = {
  track_id: number;
  type: "track";
  track_name: string;
  artist_name: string;
  artwork_url: string;
  preview_url: string;
};

type PlaylistInfo = {
  name: string;
  icon: React.ReactNode;
};

export default function PlaylistDetailPage() {
  const { id } = useParams();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();

  // デフォルトプレイリスト（likes, dislikes）以外の場合、追加ボタンを表示
  const canAddTracks = id !== "likes" && id !== "dislikes";

  // existingTrackIdsをトップレベルで計算
  const existingTrackIds = useMemo(
    () => Array.from(new Set(tracks.map((t) => t.track_id))),
    [tracks]
  );

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/playlists/${id}`);

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

      setTracks(responseData.tracks || []);

      // プレイリスト情報を設定
      if (id === "likes") {
        setPlaylistInfo({
          name: "お気に入り",
          icon: <Heart className="h-6 w-6 text-red-500 fill-current" />,
        });
      } else if (id === "dislikes") {
        setPlaylistInfo({
          name: "スキップ済み",
          icon: <Ban className="h-6 w-6 text-zinc-400" />,
        });
      } else if (responseData.playlist) {
        // カスタムプレイリストの場合
        setPlaylistInfo({
          name: responseData.playlist.title,
          icon: <Music className="h-6 w-6 text-zinc-400" />,
        });
      }
    } catch (err) {
      console.error("Error fetching playlist:", err);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
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
  }, [fetchData]);

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

  if (loading || !playlistInfo)
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
              <div className="flex items-center gap-3 flex-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900">
                  {playlistInfo.icon}
                </div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {playlistInfo.name}
                </h1>
              </div>
              {/* 曲を追加ボタン（カスタムプレイリストのみ） */}
              {canAddTracks && (
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200 transition-all active:scale-90"
                  aria-label="曲を追加"
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}
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
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
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

        {/* 曲選択モーダル */}
        {canAddTracks && (
          <SelectTrackModal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              fetchData();
            }}
            playlistId={id as string}
            existingTrackIds={existingTrackIds}
            onSuccess={(track) => {
              if (!track) return;
              setTracks((prev) =>
                prev.some((t) => t.track_id === track.track_id)
                  ? prev
                  : [...prev, track]
              );
            }}
          />
        )}
      </div>
    </Layout>
  );
}
