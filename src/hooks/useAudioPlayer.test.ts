import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';

describe('useAudioPlayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('初期状態が正しい', () => {
        const { result } = renderHook(() => useAudioPlayer());
        expect(result.current.isPlaying).toBe(false);
        expect(result.current.progress).toBe(0);
    });

    it('audioRef は HTMLAudioElement に設定される', () => {
        const { result } = renderHook(() => useAudioPlayer());
        expect(result.current.audioRef.current).toBeInstanceOf(HTMLAudioElement);
    });

    it('正常系: 有効な URL で再生開始', async () => {
        const { result } = renderHook(() => useAudioPlayer());
        await act(async () => {
            result.current.play('https://example.com/audio.mp3');
        });
        expect(result.current.isPlaying).toBe(true);
        expect(result.current.audioRef.current?.src).toBe('https://example.com/audio.mp3');
    });

    it('正常系: 空文字列 URL では何もしない', async () => {
        const { result } = renderHook(() => useAudioPlayer());
        await act(async () => {
            result.current.play('');
        });
        expect(result.current.isPlaying).toBe(false);
    });

    it('正常系: 異なる URL に切り替える', async () => {
        const { result } = renderHook(() => useAudioPlayer());
        await act(async () => {
            result.current.play('https://example.com/audio1.mp3');
        });
        expect(result.current.audioRef.current?.src).toBe('https://example.com/audio1.mp3');
        await act(async () => {
            result.current.play('https://example.com/audio2.mp3');
        });
        expect(result.current.audioRef.current?.src).toBe('https://example.com/audio2.mp3');
    });

    it('正常系: pause で一時停止', async () => {
        const { result } = renderHook(() => useAudioPlayer());
        await act(async () => {
            result.current.play('https://example.com/audio.mp3');
        });
        expect(result.current.isPlaying).toBe(true);
        act(() => {
            result.current.pause();
        });
        expect(result.current.isPlaying).toBe(false);
    });

    it('正常系: stop で停止してリセット', async () => {
        const { result } = renderHook(() => useAudioPlayer());
        await act(async () => {
            result.current.play('https://example.com/audio.mp3');
        });
        expect(result.current.isPlaying).toBe(true);
        act(() => {
            result.current.stop();
        });
        expect(result.current.isPlaying).toBe(false);
        expect(result.current.progress).toBe(0);
    });

    it('正常系: currentTime が 0 にリセット', async () => {
        const { result } = renderHook(() => useAudioPlayer());
        await act(async () => {
            result.current.play('https://example.com/audio.mp3');
        });
        const audio = result.current.audioRef.current;
        if (audio) {
            audio.currentTime = 50;
        }
        act(() => {
            result.current.stop();
        });
        expect(audio?.currentTime).toBe(0);
    });

    it('正常系: resume で再開', async () => {
        const { result } = renderHook(() => useAudioPlayer());
        await act(async () => {
            result.current.play('https://example.com/audio.mp3');
        });
        act(() => {
            result.current.pause();
        });
        expect(result.current.isPlaying).toBe(false);
        await act(async () => {
            result.current.resume();
        });
        expect(result.current.isPlaying).toBe(true);
    });

    it('play -> pause -> stop', async () => {
        const { result } = renderHook(() => useAudioPlayer());
        await act(async () => {
            result.current.play('https://example.com/audio.mp3');
        });
        expect(result.current.isPlaying).toBe(true);
        act(() => {
            result.current.pause();
        });
        expect(result.current.isPlaying).toBe(false);
        act(() => {
            result.current.stop();
        });
        expect(result.current.isPlaying).toBe(false);
        expect(result.current.progress).toBe(0);
    });

    it('play -> pause -> resume', async () => {
        const { result } = renderHook(() => useAudioPlayer());
        await act(async () => {
            result.current.play('https://example.com/audio.mp3');
        });
        act(() => {
            result.current.pause();
        });
        await act(async () => {
            result.current.resume();
        });
        expect(result.current.isPlaying).toBe(true);
    });

    it('play -> stop -> play', async () => {
        const { result } = renderHook(() => useAudioPlayer());
        await act(async () => {
            result.current.play('https://example.com/audio1.mp3');
        });
        act(() => {
            result.current.stop();
        });
        await act(async () => {
            result.current.play('https://example.com/audio2.mp3');
        });
        expect(result.current.isPlaying).toBe(true);
        expect(result.current.audioRef.current?.src).toBe('https://example.com/audio2.mp3');
    });

    it('progress 初期値は 0', () => {
        const { result } = renderHook(() => useAudioPlayer());
        expect(result.current.progress).toBe(0);
    });

    it('アンマウント時に listeners が削除される', () => {
        const { unmount, result } = renderHook(() => useAudioPlayer());
        const audio = result.current.audioRef.current;
        const removeEventListenerSpy = vi.spyOn(audio, 'removeEventListener');
        unmount();
        expect(removeEventListenerSpy).toHaveBeenCalled();
    });
});
