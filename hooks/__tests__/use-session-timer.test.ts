/**
 * @jest-environment jsdom
 */
"use client";

import { renderHook, act } from "@testing-library/react";
import { useSessionTimer, DEFAULT_BREAK_INTERVAL_MS } from "../use-session-timer";

describe("useSessionTimer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("initializes with isBreakPromptOpen = false", () => {
    const { result } = renderHook(() => useSessionTimer());
    expect(result.current.isBreakPromptOpen).toBe(false);
  });

  it("triggers break prompt after default 15 minutes (900,000ms)", () => {
    const { result } = renderHook(() => useSessionTimer());

    expect(result.current.isBreakPromptOpen).toBe(false);

    act(() => {
      jest.advanceTimersByTime(DEFAULT_BREAK_INTERVAL_MS);
    });

    expect(result.current.isBreakPromptOpen).toBe(true);
  });

  it("respects custom intervalMs", () => {
    const customInterval = 5000;
    const { result } = renderHook(() =>
      useSessionTimer({ intervalMs: customInterval })
    );

    act(() => {
      jest.advanceTimersByTime(4999);
    });
    expect(result.current.isBreakPromptOpen).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.isBreakPromptOpen).toBe(true);
  });

  it("dismissBreakPrompt closes prompt and restarts timer for next interval", () => {
    const customInterval = 1000;
    const { result } = renderHook(() =>
      useSessionTimer({ intervalMs: customInterval })
    );

    act(() => {
      jest.advanceTimersByTime(customInterval);
    });
    expect(result.current.isBreakPromptOpen).toBe(true);

    act(() => {
      result.current.dismissBreakPrompt();
    });
    expect(result.current.isBreakPromptOpen).toBe(false);

    act(() => {
      jest.advanceTimersByTime(customInterval);
    });
    expect(result.current.isBreakPromptOpen).toBe(true);
  });

  it("triggerBreakPrompt manually opens prompt and clears pending timer", () => {
    const { result } = renderHook(() => useSessionTimer());

    expect(result.current.isBreakPromptOpen).toBe(false);

    act(() => {
      result.current.triggerBreakPrompt();
    });

    expect(result.current.isBreakPromptOpen).toBe(true);
  });

  it("clears timeout on unmount to prevent memory leaks", () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
    const { unmount } = renderHook(() => useSessionTimer());

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
