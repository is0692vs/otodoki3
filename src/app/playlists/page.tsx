"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Ban, ChevronRight, Plus, Music, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Layout } from "@/components/Layout";
import { usePlaylists } from "@/hooks/usePlaylists";

type Playlist = {
  id: string;
  name: string;
  icon: string;
  count: number;
  is_default?: boolean;
};

const PlaylistIcon = ({ id, icon }: { id: string; icon?: string }) => {
  switch (id) {
    case "likes":
      return <Heart className="h-6 w-6 text-red-500 fill-current" />;
    case "dislikes":
      return <Ban className="h-6 w-6 text-muted-foreground" />;
    default:
      if (icon && icon !== "🎵") {
        return <span className="text-2xl">{icon}</span>;
      }
      return <Music className="h-6 w-6 text-muted-foreground" />;
  }
};

/**
 * ユーザーのプレイリスト一覧を表示し、新規プレイリストの作成を行うページコンポーネント。
 *
 * ページはプレイリストの読み込み・更新状態を表示し、一覧の各項目から個別プレイリストへ遷移できるUIを提供します。
 * 認証エラー（HTTP 401 / 403）が発生した場合はログインページへリダイレクトします。
 * モーダルでの新規作成はタイトルを送信してサーバーへPOSTし、成功時にプレイリストのキャッシュを無効化して一覧を更新します。
 * モーダルが開いている間は Escape キーでモーダルを閉じることができます。
 *
 * @returns このページのレンダリング結果となる JSX 要素
 */
export default function PlaylistsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: playlists = [], isLoading, isFetching, error } = usePlaylists();

  useEffect(() => {
    const status = (error as { status?: number } | null)?.status;
    if (status === 401 || status === 403) {
      router.push("/login");
    }
  }, [error, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModalOpen(false);
    };
    if (isModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistTitle.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: newPlaylistTitle }),
      });

      if (res.ok) {
        setNewPlaylistTitle("");
        setIsModalOpen(false);
        // キャッシュを無効化してリストを最新化
        queryClient.invalidateQueries({ queryKey: ["playlists"] });
      } else {
        console.error("Failed to create playlist");
      }
    } catch (err) {
      console.error("Error creating playlist:", err);
    } finally {
      setCreating(false);
    }
  };

  // 初回ロード時のみローディング表示
  if (isLoading)
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-5rem)]">
          読み込み中...
        </div>
      </Layout>
    );

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-5rem)] text-sm text-muted-foreground">
          プレイリストの取得に失敗しました
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-full p-6 pb-24 relative">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">ライブラリ</h1>
            <p className="text-muted-foreground text-sm mt-1">
              保存した曲やスキップした曲
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="p-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
            aria-label="Create Playlist"
          >
            <Plus className="h-6 w-6" />
          </button>
        </header>

        {/* キャッシュがある場合は即座に表示し、更新はバックグラウンドで */}
        {isFetching && playlists.length > 0 && (
          <div className="mb-3 text-xs text-muted-foreground">更新中...</div>
        )}

        <div className="grid gap-4">
          {playlists.map((pl) => (
            <Link
              key={pl.id}
              href={`/playlists/${pl.id}`}
              className="group flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:bg-accent transition-all active:scale-[0.98]"
              data-testid="playlist-item"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary group-hover:bg-secondary/80 transition-colors">
                <PlaylistIcon id={pl.id} icon={pl.icon} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg">{pl.name}</p>
                <p className="text-sm text-muted-foreground">{pl.count} 曲</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          ))}
        </div>

        {/* Create Playlist Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">新規プレイリスト作成</h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <form onSubmit={handleCreatePlaylist}>
                <input
                  type="text"
                  value={newPlaylistTitle}
                  onChange={(e) => setNewPlaylistTitle(e.target.value)}
                  placeholder="プレイリスト名"
                  className="w-full bg-input border border-input rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-6"
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={!newPlaylistTitle.trim() || creating}
                    className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? "作成中..." : "作成"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}