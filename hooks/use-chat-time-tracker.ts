"use client";

import { useEffect, useRef } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, increment } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger({ module: "ChatTimeTracker" });

const LOCAL_STORAGE_KEY_PREFIX = "unsynced_chat_seconds_";
const SYNC_INTERVAL_SECONDS = 60;

/**
 * Custom React hook to track cumulative active chat duration on /chat.
 * 
 * Performance & Resilience Design:
 * - Zero React re-renders: Accumulates time inside a mutable React ref (`unsyncedSecondsRef`).
 * - Active vs Idle State: Only increments time when `document.visibilityState === 'visible'`.
 * - Persistence & Recovery: Stores pending unsynced seconds in localStorage so network drops or tab closures don't lose tracked time.
 * - Periodic & Unmount Sync: Atomically flushes elapsed seconds to Firestore every 60s, on tab hide, and on component unmount via `increment(...)`.
 */
export function useChatTimeTracker() {
  const unsyncedSecondsRef = useRef<number>(0);
  const userPathRef = useRef<string | null>(null);
  const isSyncingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || !isFirebaseConfigured()) return;

    const auth = getAuth();
    let secondsCounter = 0;

    // Helper to compute user Firestore path matching existing candidate path standards
    const getUserPath = (user: { uid: string; displayName?: string | null }) => {
      const firstName = user.displayName
        ? user.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "")
        : "Actor";
      return `${user.uid}_${firstName}`;
    };

    // Flushes pending unsynced seconds to Firestore profile master doc
    const flushSeconds = async () => {
      const path = userPathRef.current;
      const delta = unsyncedSecondsRef.current;

      if (!path || delta <= 0 || isSyncingRef.current) return;

      isSyncingRef.current = true;
      const storageKey = `${LOCAL_STORAGE_KEY_PREFIX}${path}`;

      try {
        const db = getDb();
        const masterProfileRef = doc(db, `users/${path}/profile/master`);

        await setDoc(
          masterProfileRef,
          { totalChatSeconds: increment(delta) },
          { merge: true }
        );

        // Deduct flushed delta cleanly
        unsyncedSecondsRef.current = Math.max(0, unsyncedSecondsRef.current - delta);

        if (unsyncedSecondsRef.current > 0) {
          localStorage.setItem(storageKey, unsyncedSecondsRef.current.toString());
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch (err) {
        log.warn({ err, delta, path, msg: "Failed to flush chat duration to Firestore; keeping in storage/ref for retry." });
        // Keep in localStorage for resilience
        localStorage.setItem(storageKey, unsyncedSecondsRef.current.toString());
      } finally {
        isSyncingRef.current = false;
      }
    };

    // Auth listener to initialize path and restore unsynced seconds from localStorage
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const path = getUserPath(user);
        userPathRef.current = path;

        // Restore pending unsynced seconds from previous sessions/reloads
        const storageKey = `${LOCAL_STORAGE_KEY_PREFIX}${path}`;
        try {
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            const parsed = parseInt(stored, 10);
            if (!isNaN(parsed) && parsed > 0) {
              unsyncedSecondsRef.current += parsed;
            }
          }
        } catch (e) {
          log.warn({ err: e, msg: "Failed to load unsynced chat seconds from localStorage." });
        }
      } else {
        userPathRef.current = null;
      }
    });

    // Interval tick every 1 second
    const timerId = setInterval(() => {
      if (typeof document === "undefined") return;
      if (document.visibilityState !== "visible") return;
      if (!userPathRef.current) return;

      unsyncedSecondsRef.current += 1;
      secondsCounter += 1;

      // Update localStorage backup periodically (every 5 seconds)
      if (secondsCounter % 5 === 0 && userPathRef.current) {
        const storageKey = `${LOCAL_STORAGE_KEY_PREFIX}${userPathRef.current}`;
        try {
          localStorage.setItem(storageKey, unsyncedSecondsRef.current.toString());
        } catch {
          // Ignore localStorage save failures
        }
      }

      // Batch flush every 60 seconds
      if (secondsCounter >= SYNC_INTERVAL_SECONDS) {
        secondsCounter = 0;
        void flushSeconds();
      }
    }, 1000);

    // Sync on tab visibility change or unload
    const handleVisibilityOrUnload = () => {
      if (document.visibilityState === "hidden") {
        void flushSeconds();
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityOrUnload);
    window.addEventListener("beforeunload", handleVisibilityOrUnload);

    return () => {
      unsubscribeAuth();
      clearInterval(timerId);
      window.removeEventListener("visibilitychange", handleVisibilityOrUnload);
      window.removeEventListener("beforeunload", handleVisibilityOrUnload);

      // Cleanup flush remaining unsynced time
      void flushSeconds();
    };
  }, []);
}
