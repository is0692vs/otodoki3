"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AudioPlayerState = {
    isPlaying: boolean;
    progress: number; // 0-100
};

export function useAudioPlayer() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const preloadAudioRef = useRef<HTMLAudioElement | null>(null);
    const [state, setState] = useState<AudioPlayerState>({
        isPlaying: false,
        progress: 0,
    });

    const stop = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.pause();
        audio.currentTime = 0;

        setState((prev) => ({ ...prev, isPlaying: false, progress: 0 }));
    }, []);

    const pause = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;

        audio.pause();
        setState((prev) => ({ ...prev, isPlaying: false }));
    }, []);

    const resume = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || !audio.src) return;

        const playPromise = audio.play();
        setState((prev) => ({ ...prev, isPlaying: true }));

        if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch((err) => {
                console.error("Failed to resume audio", err);
                setState((prev) => ({ ...prev, isPlaying: false }));
            });
        }
    }, []);

    const play = useCallback(
        (previewUrl: string) => {
            const audio = audioRef.current;
            if (!audio) return;

            const trimmed = previewUrl.trim();
            if (!trimmed) return;

            if (audio.src !== trimmed) {
                audio.src = trimmed;
            }

            // 再生開始はユーザージェスチャーに紐づく必要がある
            // （呼び出し側で非同期を挟まないこと）
            const playPromise = audio.play();

            setState((prev) => ({ ...prev, isPlaying: true }));

            if (playPromise && typeof playPromise.catch === "function") {
                playPromise.catch((err) => {
                    console.error("Failed to play preview audio", err);
                    stop();
                });
            }
        },
        [stop]
    );

    const preload = useCallback((previewUrl: string) => {
        const trimmed = previewUrl.trim();
        if (!trimmed) return;

        if (!preloadAudioRef.current) {
            preloadAudioRef.current = new Audio();
        }

        const audio = preloadAudioRef.current;
        audio.preload = "auto";
        audio.volume = 0;

        // If we're switching URLs, abort any in-flight request first.
        try {
            if (audio.src && audio.src !== trimmed) {
                audio.pause();
                audio.src = "";
                audio.load();
            }
        } catch (err) {
            console.error("Failed to abort previous preload", err, { src: audio?.src });
            // Best-effort to leave the element in a safe state
            try {
                audio.pause();
            } catch (_) {
                /* ignore */
            }
            try {
                audio.src = "";
            } catch (_) {
                /* ignore */
            }
        }

        try {
            if (audio.src !== trimmed) {
                audio.src = trimmed;
                audio.load();
            }
        } catch (err) {
            console.error("Failed to preload audio", err, { src: trimmed });
            // Ensure the element is not pointing to a broken src
            try {
                audio.pause();
            } catch (_) {
                /* ignore */
            }
            try {
                audio.src = "";
            } catch (_) {
                /* ignore */
            }
        }
    }, []);

    useEffect(() => {
        if (audioRef.current) return;

        const audio = new Audio();
        audio.preload = "auto";
        audioRef.current = audio;

        let rafId: number | null = null;
        const handleTimeUpdate = () => {
            // requestAnimationFrameで更新頻度を調整し、カクつきを防ぐ
            if (rafId !== null) return;

            rafId = requestAnimationFrame(() => {
                const duration = audio.duration;
                const currentTime = audio.currentTime;
                const progress =
                    Number.isFinite(duration) && duration > 0
                        ? Math.min(100, Math.max(0, (currentTime / duration) * 100))
                        : 0;

                setState((prev) => (prev.progress === progress ? prev : { ...prev, progress }));
                rafId = null;
            });
        };

        const handleEnded = () => {
            // ループ再生: 先頭に戻して再度再生
            audio.currentTime = 0;
            audio.play().catch((err) => {
                console.error("Failed to loop preview audio", err);
                setState((prev) => ({ ...prev, isPlaying: false, progress: 100 }));
            });
        };

        const handleError = () => {
            // 403/404 などもここに来る
            console.error("Audio element error", {
                src: audio.src,
                error: audio.error,
            });
            stop();
        };

        const handlePlay = () => {
            setState((prev) => ({ ...prev, isPlaying: true }));
        };

        const handlePause = () => {
            setState((prev) => ({ ...prev, isPlaying: false }));
        };

        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("ended", handleEnded);
        audio.addEventListener("error", handleError);
        audio.addEventListener("play", handlePlay);
        audio.addEventListener("pause", handlePause);

        return () => {
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
            audio.pause();
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("ended", handleEnded);
            audio.removeEventListener("error", handleError);
            audio.removeEventListener("play", handlePlay);
            audio.removeEventListener("pause", handlePause);
            audioRef.current = null;

            const preloadAudio = preloadAudioRef.current;
            if (preloadAudio) {
                preloadAudio.pause();
                preloadAudio.src = "";
                preloadAudio.load();
                preloadAudioRef.current = null;
            }
        };
    }, [stop]);

    return {
        audioRef,
        preload,
        play,
        stop,
        pause,
        resume,
        isPlaying: state.isPlaying,
        progress: state.progress,
    };
}
