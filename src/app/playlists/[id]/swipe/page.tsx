"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { TrackCardStack } from "@/components/TrackCardStack";
import { Layout } from "@/components/Layout";

type Track = {
  track_id: number;
  type: "track";
  track_name: string;
  artist_name: string;
  artwork_url: string;
  preview_url: string;
};

export default function PlaylistSwipePage() {
  const { id } = useParams();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
  }, [id, router]);

  if (loading)
    return (
      <Layout>
        <div className="bg-black text-white flex items-center justify-center">
          読み込み中...
        </div>
      </Layout>
    );
  if (tracks.length === 0)
    return (
      <Layout>
        <div className="bg-black text-white flex flex-col items-center justify-center gap-4">
          <p>曲がありません</p>
          <button
            type="button"
            onClick={() => router.push(`/playlists/${id}`)}
            className="rounded-lg shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 text-sm"
          >
            プレイリストに戻る
          </button>
        </div>
      </Layout>
    );

  // TrackCardStackにプレイリストモードを渡す
  // 補充なし + 終了時にメッセージ表示
  return (
    <Layout>
      <div className="bg-black text-white p-4">
        <div className="mb-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push(`/playlists/${id}`)}
            className="rounded-lg shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 text-lg"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold">スワイプで再評価</h1>
        </div>
        <div className="flex justify-center">
          <TrackCardStack
            tracks={tracks}
            mode="playlist"
            sourcePlaylist={id as string}
          />
        </div>
      </div>
    </Layout>
  );
}
