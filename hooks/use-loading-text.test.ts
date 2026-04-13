/**
 * @jest-environment jsdom
 */
"use client";

import { renderHook, act } from "@testing-library/react";
import { useLoadingText } from "./use-loading-text";
import { LOADING_TEXTS } from "@/lib/loading-texts";

describe("useLoadingText", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns correct text for type based on index", () => {
    const { result } = renderHook(() => useLoadingText("ai", 1500));
    expect(result.current).toBe(LOADING_TEXTS.ai[0]);
  });

  it("cycles through texts correctly (index increments modulo texts.length)", () => {
    const { result } = renderHook(() => useLoadingText("ai", 100));

    expect(result.current).toBe(LOADING_TEXTS.ai[0]);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe(LOADING_TEXTS.ai[1]);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe(LOADING_TEXTS.ai[2]);

    const remainingSteps = LOADING_TEXTS.ai.length - 3;
    act(() => {
      jest.advanceTimersByTime(100 * remainingSteps);
    });
    expect(result.current).toBe(LOADING_TEXTS.ai[LOADING_TEXTS.ai.length - 1]);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe(LOADING_TEXTS.ai[0]);
  });

  it("cleanup on unmount (clearInterval called)", () => {
    const clearIntervalSpy = jest.spyOn(global, "clearInterval");
    const { unmount } = renderHook(() => useLoadingText("ui", 1500));

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    clearIntervalSpy.mockRestore();
  });

  it("returns correct string value", () => {
    const { result } = renderHook(() => useLoadingText("ui", 1500));
    expect(typeof result.current).toBe("string");
    expect(LOADING_TEXTS.ui).toContain(result.current);
  });
});
