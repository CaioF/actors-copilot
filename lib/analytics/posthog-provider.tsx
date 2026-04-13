"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

/**
 * Initializes PostHog analytics with session recording.
 * Only runs in the browser (client-side).
 */
export function usePostHog() {
  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        defaults: "2026-01-30",
        person_profiles: "identified_only",
        capture_pageview: true,
        capture_pageleave: true,
        session_recording: {
          maskAllInputs: false,
        },
        loaded: (posthog) => {
          if (process.env.NODE_ENV === "development") {
            posthog.debug();
          }
        },
      });
    }
  }, []);
}

/**
 * PostHog analytics provider component.
 * Wrap your app with this to enable analytics globally.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  usePostHog();
  return <>{children}</>;
}
