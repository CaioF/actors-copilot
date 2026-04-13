"use client";

import { useState, useEffect } from "react";
import { LOADING_TEXTS, LoadingTextType } from "@/lib/loading-texts";

/**
 * Hook that cycles through loading texts of a given type.
 * Returns the current text, rotating every `intervalMs` milliseconds.
 */
export function useLoadingText(type: LoadingTextType, intervalMs = 1500): string {
  const texts = LOADING_TEXTS[type];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % texts.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [texts.length, intervalMs]);

  return texts[index];
}
