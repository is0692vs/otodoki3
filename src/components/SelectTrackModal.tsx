"use client";

import { useState, useEffect, useRef } from "react";
import { X, Music, Check, Pause } from "lucide-react";
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
  const [addedTracks, setAddedTracks] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // 音声プレビュー再生用
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  const handlePreviewClick = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    // 同じ曲なら停止
    if (playingId === track.track_id) {
      stopAudio();
      return;
    }

    // 以前の音声を停止
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (!track.preview_url) return;

    audioRef.current = new Audio(track.preview_url);
    audioRef.current.onended = () => setPlayingId(null);
    audioRef.current.play().catch(() => {});
    setPlayingId(track.track_id);
  };

  // モーダルが閉じられた or コンポーネントがアンマウントされたときは音声を停止
  useEffect(() => {
    if (!isOpen) {
      stopAudio();
    }
    return () => stopAudio();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchLikesTracks();
      // トーストをリセット
      setToast(null);
    }
  }, [isOpen]);

  // existingTrackIds が変わった時（追加された時）に addedTracks を同期
  useEffect(() => {
    if (isOpen) {
      setAddedTracks(new Set(existingTrackIds));
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

    // 追加時はプレビューを停止して重複再生を防止
    stopAudio();

    // 楽観的更新：即座に反映
    setAddedTracks((prev) => new Set([...prev, trackId]));

    const trackToReturn = tracks.find((t) => t.track_id === trackId);
    if (trackToReturn) {
      onSuccess?.(trackToReturn);
    }

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
          message: "曲を追加しました",
          type: "success",
        });
      } else if (res.status === 409) {
        setToast({
          message: "既にこのプレイリストに追加されています",
          type: "error",
        });
      } else {
        // 失敗した場合はロールバック
        setAddedTracks((prev) => {
          const next = new Set(prev);
          next.delete(trackId);
          return next;
        });
        setToast({
          message: "追加に失敗しました",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error adding track:", err);
      // 失敗した場合はロールバック
      setAddedTracks((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
      setToast({
        message: "エラーが発生しました",
        type: "error",
      });
    }
  };

  const handleRemoveTrack = async (trackId: number) => {
    if (!addedTracks.has(trackId)) {
      return;
    }

    // 楽観的更新：即座に削除を反映
    setAddedTracks((prev) => {
      const next = new Set(prev);
      next.delete(trackId);
      return next;
    });

    // 再生中なら停止
    if (playingId === trackId) {
      stopAudio();
    }

    try {
      const res = await fetch(`/api/playlists/${playlistId}/tracks`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ track_id: trackId }),
      });

      if (res.ok) {
        setToast({
          message: "曲を削除しました",
          type: "success",
        });
      } else {
        // 失敗した場合はロールバック
        setAddedTracks((prev) => new Set([...prev, trackId]));
        setToast({
          message: "削除に失敗しました",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Error removing track:", err);
      // 失敗した場合はロールバック
      setAddedTracks((prev) => new Set([...prev, trackId]));
      setToast({
        message: "エラーが発生しました",
        type: "error",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
        <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl">
          {/* ヘッダー */}
          <div className="flex justify-between items-center p-6 border-b border-border">
            <h2 className="text-xl font-bold truncate mr-2 text-foreground">
              お気に入りから曲を選択
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="閉じる"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* 曲一覧 */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : tracks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm">お気に入りに曲がありません</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {tracks.map((track) => {
                  const trackId = track.track_id;
                  const isAlreadyInPlaylist = addedTracks.has(trackId);

                  return (
                    <div
                      key={track.track_id}
                      className={`group flex w-full items-center gap-3 p-3 rounded-xl transition-all min-w-0 ${
                        isAlreadyInPlaylist
                          ? "bg-green-500/10"
                          : "bg-secondary/50 hover:bg-secondary active:scale-[0.98]"
                      }`}
                    >
                      <div
                        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted cursor-pointer"
                        onClick={(e) => handlePreviewClick(e, track)}
                        role="button"
                        aria-label={`プレビュー: ${track.track_name}`}
                      >
                        <Image
                          src={track.artwork_url}
                          alt={track.track_name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        {playingId === trackId && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                            <Pause className="h-5 w-5 text-white fill-current" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium truncate text-foreground text-sm">
                          {track.track_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {track.artist_name}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          isAlreadyInPlaylist
                            ? handleRemoveTrack(trackId)
                            : handleAddTrack(trackId)
                        }
                        className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                        aria-label={isAlreadyInPlaylist ? "削除" : "追加"}
                      >
                        {isAlreadyInPlaylist ? (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 hover:bg-green-500/30">
                            <Check className="h-5 w-5 text-green-600" />
                          </div>
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-secondary-foreground/10 group-hover:text-foreground transition-colors">
                            <Music className="h-4 w-4" />
                          </div>
                        )}
                      </button>
                    </div>
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
