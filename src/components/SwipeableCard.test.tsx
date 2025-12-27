import React from "react";
import { render, cleanup, act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { SwipeableCard, SwipeableCardRef } from "./SwipeableCard";

const mockTrack = {
  type: "track" as const,
  track_id: "track-1",
  track_name: "Test Track",
  artist_name: "Test Artist",
  preview_url: "https://example.com/preview.mp3",
};

describe("SwipeableCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("アニメーション完了後にロックが解除され連続スワイプできる", () => {
    const onSwipe = vi.fn();
    const ref = React.createRef<SwipeableCardRef>();

    render(<SwipeableCard ref={ref} item={mockTrack} isTop onSwipe={onSwipe} index={0} />);

    act(() => {
      ref.current?.swipeLeft();
    });
    act(() => {
      vi.runAllTimers();
    });

    act(() => {
      ref.current?.swipeRight();
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(onSwipe).toHaveBeenNthCalledWith(1, "left", mockTrack);
    expect(onSwipe).toHaveBeenNthCalledWith(2, "right", mockTrack);
  });

  it("キーボード操作でもロックが解除される", () => {
    const onSwipe = vi.fn();

    render(<SwipeableCard item={mockTrack} isTop onSwipe={onSwipe} index={0} />);
    const card = screen.getByLabelText("Test Track by Test Artistをスワイプ");

    act(() => {
      fireEvent.keyDown(card, { key: "ArrowLeft" });
    });
    act(() => {
      vi.runAllTimers();
    });

    act(() => {
      fireEvent.keyDown(card, { key: "ArrowRight" });
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(onSwipe).toHaveBeenNthCalledWith(1, "left", mockTrack);
    expect(onSwipe).toHaveBeenNthCalledWith(2, "right", mockTrack);
  });
});
