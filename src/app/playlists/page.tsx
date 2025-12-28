"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Ban, ChevronRight } from "lucide-react";

import { Layout } from "@/components/Layout";

type Playlist = { id: string; name: string; icon: string; count: number };

const PlaylistIcon = ({ id }: { id: string }) => {
  switch (id) {
    case "likes":
      return <Heart className="h-6 w-6 text-red-500 fill-current" />;
    case "dislikes":
      return <Ban className="h-6 w-6 text-zinc-400" />;
    default:
      return <Heart className="h-6 w-6 text-zinc-400" />;
  }
};

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/playlists");
        if (res.status === 401 || res.status === 403) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          console.error("Fetch error:", res.status);
          setLoading(false);
          return;
        }
        const { playlists } = await res.json();
        setPlaylists(playlists);
      } catch (err) {
        console.error("Network error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  if (loading)
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-5rem)]">
          読み込み中...
        </div>
      </Layout>
    );

  return (
    <Layout>
      <div className="min-h-full p-6 pb-24">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">ライブラリ</h1>
          <p className="text-zinc-400 text-sm mt-1">
            保存した曲やスキップした曲
          </p>
        </header>

        <div className="grid gap-4">
          {playlists.map((pl) => (
            <Link
              key={pl.id}
              href={`/playlists/${pl.id}`}
              className="group flex items-center gap-4 p-4 glass rounded-2xl hover:bg-white/10 transition-all active:scale-[0.98]"
              data-testid="playlist-item"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-900 group-hover:bg-zinc-800 transition-colors">
                <PlaylistIcon id={pl.id} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg">{pl.name}</p>
                <p className="text-sm text-zinc-400">{pl.count} 曲</p>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
