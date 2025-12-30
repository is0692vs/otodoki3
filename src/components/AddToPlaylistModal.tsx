"use client";

import { useState, useEffect, useRef } from "react";
import { X, Music, ChevronRight } from "lucide-react";
import { Toast } from "./Toast";

type Playlist = {
  id: string;
  name: string;
  icon: string;
  count: number;
  is_default?: boolean;
};

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId: number;
  onSuccess?: () => void;
}

export function AddToPlaylistModal({
  isOpen,
  onClose,
  trackId,
  onSuccess,
}: AddToPlaylistModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPlaylists();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current != null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/playlists");
      if (!res.ok) {
        console.error("Failed to fetch playlists:", res.status);
        return;
      }
      const data = await res.json();
      // is_default: false のプレイリストのみフィルタ
      const userPlaylists = data.playlists.filter(
        (p: Playlist) => !p.is_default
      );
      setPlaylists(userPlaylists);
    } catch (err) {
      console.error("Error fetching playlists:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    const playlist = playlists.find((p) => p.id === playlistId);
    if (!playlist) return;

    setAdding(playlistId);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ track_id: trackId }),
      });

      if (res.ok) {
        setToast({
          message: `「${playlist.name}」に追加しました`,
          type: "success",
        });
        onSuccess?.();
        if (closeTimerRef.current != null) {
          window.clearTimeout(closeTimerRef.current);
        }
        closeTimerRef.current = window.setTimeout(() => {
          onClose();
          setToast(null);
          closeTimerRef.current = null;
        }, 1500);
      } else if (res.status === 409) {
        setToast({
          message: "既に追加されています",
          type: "error",
        });
      } else {
        setToast({
          message: "追加に失敗しました",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error adding track to playlist:", err);
      setToast({
        message: "エラーが発生しました",
        type: "error",
      });
    } finally {
      setAdding(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl">
          {/* ヘッダー */}
          <div className="flex justify-between items-center p-6 border-b border-zinc-800">
            <h2 className="text-xl font-bold">プレイリストを選択</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors"
              aria-label="閉じる"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* プレイリスト一覧 */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            ) : playlists.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">プレイリストがありません</p>
                <p className="text-xs mt-2 opacity-60">
                  ライブラリから作成してください
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    type="button"
                    onClick={() => handleAddToPlaylist(playlist.id)}
                    disabled={adding === playlist.id}
                    className="group flex items-center gap-4 p-4 bg-zinc-800/50 rounded-xl hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-900 text-2xl">
                      {playlist.icon && playlist.icon !== "🎵" ? (
                        playlist.icon
                      ) : (
                        <Music className="h-6 w-6 text-zinc-400" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold">{playlist.name}</p>
                      <p className="text-sm text-zinc-400">
                        {playlist.count} 曲
                      </p>
                    </div>
                    {adding === playlist.id ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* トースト */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={!!toast}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
