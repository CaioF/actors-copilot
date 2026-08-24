"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export const DEFAULT_BREAK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export interface UseSessionTimerOptions {
  /**
   * Time in milliseconds before triggering the break check-in prompt.
   * Defaults to 15 minutes (900,000 ms).
   */
  intervalMs?: number;
  /**
   * Whether the timer is enabled.
   * Defaults to true.
   */
  enabled?: boolean;
}

export interface UseSessionTimerReturn {
  /**
   * Whether the session break check-in modal/prompt is currently open.
   */
  isBreakPromptOpen: boolean;
  /**
   * Dismisses the break check-in prompt and resets/snoozes the timer for another interval.
   */
  dismissBreakPrompt: () => void;
  /**
   * Manually resets the session timer.
   */
  resetTimer: () => void;
  /**
   * Manually triggers the break check-in prompt (useful for testing or manual triggers).
   */
  triggerBreakPrompt: () => void;
}

/**
 * Custom hook to track active chat session time and prompt the user for a mental break after a set interval.
 * Isolates timer state so it does not trigger unnecessary re-renders in chat message lists.
 */
export function useSessionTimer({
  intervalMs = DEFAULT_BREAK_INTERVAL_MS,
  enabled = true,
}: UseSessionTimerOptions = {}): UseSessionTimerReturn {
  const [isBreakPromptOpen, setIsBreakPromptOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    if (!enabled) return;

    timerRef.current = setTimeout(() => {
      setIsBreakPromptOpen(true);
    }, intervalMs);
  }, [clearTimer, enabled, intervalMs]);

  useEffect(() => {
    startTimer();
    return () => {
      clearTimer();
    };
  }, [startTimer, clearTimer]);

  const dismissBreakPrompt = useCallback(() => {
    setIsBreakPromptOpen(false);
    startTimer();
  }, [startTimer]);

  const resetTimer = useCallback(() => {
    setIsBreakPromptOpen(false);
    startTimer();
  }, [startTimer]);

  const triggerBreakPrompt = useCallback(() => {
    clearTimer();
    setIsBreakPromptOpen(true);
  }, [clearTimer]);

  return {
    isBreakPromptOpen,
    dismissBreakPrompt,
    resetTimer,
    triggerBreakPrompt,
  };
}
