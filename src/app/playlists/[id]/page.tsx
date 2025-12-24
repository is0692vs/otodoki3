"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

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
      ? { name: "お気に入り", icon: "❤️" }
      : { name: "スキップ済み", icon: "🚫" };

  useEffect(() => {
    const fetchData = async () => {
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
        const { tracks } = await res.json();
        setTracks(tracks);
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
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        読み込み中...
      </div>
    );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/playlists")}
              className="text-2xl hover:opacity-70"
            >
              ←
            </button>
            <span className="text-3xl">{playlistMeta.icon}</span>
            <h1 className="text-2xl font-bold">{playlistMeta.name}</h1>
          </div>
          <Link
            href={`/playlists/${id}/swipe`}
            className="px-4 py-2 bg-green-500 rounded-full text-sm font-medium"
          >
            スワイプで再評価
          </Link>
        </div>

        {tracks.length === 0 ? (
          <p className="text-center text-gray-400 py-8">曲がありません</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tracks.map((track) => (
              <button
                key={track.track_id}
                type="button"
                onClick={() => handlePlay(track)}
                className="bg-gray-800 rounded-lg p-3 text-left hover:bg-gray-700"
              >
                <Image
                  src={track.artwork_url}
                  alt={track.track_name}
                  width={200}
                  height={200}
                  className="w-full aspect-square object-cover rounded mb-2"
                />
                <p className="font-medium truncate">{track.track_name}</p>
                <p className="text-sm text-gray-400 truncate">
                  {track.artist_name}
                </p>
                {playingId === track.track_id && (
                  <span className="text-green-400 text-xs">▶ 再生中</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
