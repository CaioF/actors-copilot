"use client";

import { useState, useCallback, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
} from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { CoachMessage, CoachSession } from "@/lib/chat-types";
import { createChildLogger } from "@/lib/logger";
import type { AttachedDocument } from "@/components/chat-input";

const log = createChildLogger({ module: "CoachExtraction" });
const DEFAULT_SESSION_ID = "coach-session-1";

interface UseActingCoachReturn {
  messages: CoachMessage[];
  isLoading: boolean;
  error: string | null;
  /**
   * Sends a message to the AI coach, optionally including audition context and an attached document.
   */
  sendMessage: (content: string, auditionId?: string, document?: AttachedDocument | null) => Promise<void>;
  startNewSession: (opts?: { linkedAuditionId?: string | null }) => Promise<void>;
  clearSessionFocus: () => Promise<void>;
  session: CoachSession | null;
  sessionId: string;
}

export function useActingCoach(): UseActingCoachReturn {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(DEFAULT_SESSION_ID);
  const [userPath, setUserPath] = useState<string | null>(null);
  const [session, setSession] = useState<CoachSession | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // --- Auth & Path Initialization ---
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setIsAuthLoading(false);
      return;
    }
    const auth = getAuth();
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        const firstName = user.displayName
          ? user.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "")
          : "Actor";
        setUserPath(`${user.uid}_${firstName}`);
      } else {
        setUserPath(null);
      }
      setIsAuthLoading(false);
    });
  }, []);

  // --- Session Metadata Listener ---
  useEffect(() => {
    if (!isFirebaseConfigured() || isAuthLoading || !userPath) return;

    const sessionRef = doc(getDb(), `users/${userPath}/coachSessions/${sessionId}`);
    return onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        setSession({ id: docSnap.id, ...(docSnap.data() as Omit<CoachSession, "id">) });
      } else {
        // Initialize new session document if it doesn't exist
        void setDoc(sessionRef, {
          createdAt: serverTimestamp(),
          lastActiveAt: serverTimestamp(),
          status: "active",
          title: "New Session",
          linkedAuditionId: null,
          messageCount: 0,
          sessionFocus: null,
          stepIndex: 0,
          mode: null,
          phase: null,
        });
      }
    }, () => setSession(null));
  }, [userPath, sessionId, isAuthLoading]);

  // --- Messages History Listener ---
  useEffect(() => {
    if (!isFirebaseConfigured() || isAuthLoading || !userPath) return;

    const messagesRef = collection(getDb(), `users/${userPath}/coachSessions/${sessionId}/messages`);
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    return onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CoachMessage);
      setMessages(msgs);
    }, () => setMessages([]));
  }, [userPath, sessionId, isAuthLoading]);

  // --- Core Message Logic ---
  const sendMessage = useCallback(
    async (content: string, auditionId?: string, document?: AttachedDocument | null) => {
      const trimmedContent = content.trim();
      if (!trimmedContent) return;

      setIsLoading(true);
      setError(null);

      try {
        const auth = getAuth();
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Authentication required");

        const history = messages.map((msg) => ({ role: msg.role, content: msg.content }));

        // 1. Write user message to Firestore (only if path exists)
        if (userPath) {
          const messagesRef = collection(getDb(), `users/${userPath}/coachSessions/${sessionId}/messages`);
          await addDoc(messagesRef, {
            role: "user",
            content: trimmedContent,
            timestamp: serverTimestamp(),
          });
        }

        // 2. Call the backend API
        const response = await fetch("/api/coach/chat", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: trimmedContent,
            history,
            auditionId,
            currentFocus: session?.sessionFocus ?? null,
            document: document || undefined,
          }),
        });

        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const data = await response.json();
        if (!data?.aiData?.coach_reply) throw new Error("Invalid response from coach");

        // 3. Write assistant reply to Firestore
        if (userPath) {
          const sessionRef = doc(getDb(), `users/${userPath}/coachSessions/${sessionId}`);
          const messagesRef = collection(sessionRef, "messages");

          await addDoc(messagesRef, {
            role: "assistant",
            content: data.aiData.coach_reply,
            timestamp: serverTimestamp(),
          });

          // Update session metadata
          await updateDoc(sessionRef, {
            lastActiveAt: serverTimestamp(),
            messageCount: increment(1),
            sessionFocus: data.aiData.session_focus ?? null,
            stepIndex: data.aiData.step_index ?? 0,
            mode: data.aiData.mode ?? null,
            phase: data.aiData.phase ?? null,
          });

          // 4. Handle DNA Extraction Quality Gate
          if (data.aiData.action?.type === "trigger_dna_extraction" && data.aiData.extractions) {
            const aiExtractions = data.aiData.extractions;
            const isHighQuality =
              aiExtractions.progress_assessment?.has_actionable_pattern === true &&
              (aiExtractions.progress_assessment?.depth_score ?? 0) >= 4;

            if (isHighQuality) {
              const profileRef = doc(getDb(), `users/${userPath}/profile/master`);
              const updatePayload: Record<string, any> = { lastUpdated: serverTimestamp() };

              // Map extraction fields to Firestore schema
              if (aiExtractions.new_traits?.length) updatePayload["psychology.traits"] = arrayUnion(...aiExtractions.new_traits);
              if (aiExtractions.core_values?.length) updatePayload["psychology.coreValues"] = arrayUnion(...aiExtractions.core_values);
              if (aiExtractions.somatic_tells?.length) updatePayload["physicality.somaticTells"] = arrayUnion(...aiExtractions.somatic_tells);
              // Add other mappings as needed...

              await setDoc(profileRef, updatePayload, { merge: true });
              log.debug("Coach extraction written to profile/master");
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get coach response");
      } finally {
        setIsLoading(false);
      }
    },
    [messages, session, sessionId, userPath]
  );

  const startNewSession = useCallback(
    async (opts?: { linkedAuditionId?: string | null }) => {
      if (!userPath) return;
      const newSessionId = crypto.randomUUID();
      await setDoc(doc(getDb(), `users/${userPath}/coachSessions/${newSessionId}`), {
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        status: "active",
        title: "New Session",
        linkedAuditionId: opts?.linkedAuditionId ?? null,
        messageCount: 0,
        sessionFocus: null,
        stepIndex: 0,
        mode: null,
        phase: null,
      });
      setMessages([]);
      setError(null);
      setSessionId(newSessionId);
    },
    [userPath]
  );

  const clearSessionFocus = useCallback(async () => {
    if (!userPath) return;
    await updateDoc(doc(getDb(), `users/${userPath}/coachSessions/${sessionId}`), {
      sessionFocus: null,
      mode: null,
      stepIndex: 0,
      phase: null,
    });
  }, [userPath, sessionId]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    startNewSession,
    clearSessionFocus,
    session,
    sessionId,
  };
}