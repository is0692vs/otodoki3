"use client";

import { useState, useEffect } from "react";
import { X, Music, Check } from "lucide-react";
import Image from "next/image";
import { Toast } from "./Toast";

type Track = {
  track_id: number;
  type: "track";
  track_name: string;
  artist_name: string;
  artwork_url: string;
  preview_url: string;
};

interface SelectTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlistId: string;
  existingTrackIds?: number[];
  onSuccess?: (track?: Track) => void;
}

export function SelectTrackModal({
  isOpen,
  onClose,
  playlistId,
  existingTrackIds = [],
  onSuccess,
}: SelectTrackModalProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [addedTracks, setAddedTracks] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchLikesTracks();
      // existingTrackIdsをinitial stateとして設定
      // 毎回モーダルを開く時に existingTrackIds を反映
      setAddedTracks(new Set(existingTrackIds));
      // トーストをリセット
      setToast(null);
    }
  }, [isOpen, existingTrackIds]);

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

  const fetchLikesTracks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/playlists/likes");
      if (!res.ok) {
        console.error("Failed to fetch likes:", res.status);
        return;
      }
      const data = await res.json();
      setTracks(data.tracks || []);
    } catch (err) {
      console.error("Error fetching likes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTrack = async (trackId: number) => {
    if (addedTracks.has(trackId)) {
      return;
    }

    setAdding(trackId);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ track_id: trackId }),
      });

      if (res.ok) {
        const data = await res.json();
        // 楽観的更新：即座に addedTracks に反映
        setAddedTracks((prev) => new Set([...prev, trackId]));
        // API レスポンスから track 情報を取得、なければ local state から取得
        const trackToReturn =
          data.track || tracks.find((t) => t.track_id === trackId);
        // 親に即通知（リロードなし）
        onSuccess?.(trackToReturn);
        // トーストは最後に表示（スクロール位置維持）
        setToast({
          message: "曲を追加しました",
          type: "success",
        });
      } else if (res.status === 409) {
        setToast({
          message: "既にこのプレイリストに追加されています",
          type: "error",
        });
        // 409でもaddedTracksに追加してUIを更新（実験的）
        setAddedTracks((prev) => new Set([...prev, trackId]));
      } else {
        setToast({
          message: "追加に失敗しました",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error adding track:", err);
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
            <h2 className="text-xl font-bold">お気に入りから曲を選択</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors"
              aria-label="閉じる"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* 曲一覧 */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
            ) : tracks.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">お気に入りに曲がありません</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {tracks.map((track) => {
                  const trackId = track.track_id;
                  const isAlreadyInPlaylist = addedTracks.has(trackId);
                  const isAdding = adding === trackId;

                  return (
                    <button
                      key={track.track_id}
                      type="button"
                      onClick={() =>
                        !isAlreadyInPlaylist && handleAddTrack(trackId)
                      }
                      disabled={isAlreadyInPlaylist || isAdding}
                      className={`group flex items-center gap-3 p-3 rounded-xl transition-all ${
                        isAlreadyInPlaylist
                          ? "bg-green-500/10 cursor-default"
                          : "bg-zinc-800/50 hover:bg-zinc-800 active:scale-[0.98]"
                      } ${isAdding ? "opacity-50" : ""}`}
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                        <Image
                          src={track.artwork_url}
                          alt={track.track_name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium truncate text-white text-sm">
                          {track.track_name}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">
                          {track.artist_name}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {isAdding ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : isAlreadyInPlaylist ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
                            <Check className="h-5 w-5 text-green-400" />
                          </div>
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-zinc-400 group-hover:bg-zinc-600 group-hover:text-white transition-colors">
                            <Music className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
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
