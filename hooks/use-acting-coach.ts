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
  getDocs,
  setDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { CoachMessage, CoachSession } from "@/lib/chat-types";

const DEFAULT_SESSION_ID = "coach-session-1";

interface UseActingCoachReturn {
  messages: CoachMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, auditionId?: string) => Promise<void>;
  clearSession: () => void;
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

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setIsAuthLoading(false);
      return;
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
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

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || isAuthLoading || !userPath) return;

    const sessionRef = doc(
      getDb(),
      `users/${userPath}/coachSessions/${sessionId}`
    );

    const unsubscribe = onSnapshot(
      sessionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setSession({
            id: docSnap.id,
            ...(docSnap.data() as Omit<CoachSession, "id">),
          });
        } else {
          void setDoc(sessionRef, {
            createdAt: serverTimestamp(),
            lastActiveAt: serverTimestamp(),
            status: "active",
            title: "New Session",
            linkedAuditionId: null,
            messageCount: 0,
          });
        }
      },
      () => {
        setSession(null);
      }
    );

    return () => unsubscribe();
  }, [userPath, sessionId, isAuthLoading]);

  useEffect(() => {
    if (!isFirebaseConfigured() || isAuthLoading || !userPath) return;

    const messagesRef = collection(
      getDb(),
      `users/${userPath}/coachSessions/${sessionId}/messages`
    );
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...d.data(),
            }) as CoachMessage
        );
        setMessages(msgs);
      },
      () => {
        setMessages([]);
      }
    );

    return () => unsubscribe();
  }, [userPath, sessionId, isAuthLoading]);

  const sendMessage = useCallback(
    async (content: string, auditionId?: string) => {
      if (!content.trim()) return;

      const userMsg: CoachMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      try {
        const auth = getAuth();
        const idToken = await auth.currentUser?.getIdToken();

        if (!idToken) {
          throw new Error("Authentication required");
        }

        const history = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        const response = await fetch("/api/coach/chat", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: content.trim(),
            history,
            auditionId,
          }),
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data?.aiData?.coach_reply) {
          throw new Error("Invalid response from coach");
        }

        const assistantMsg: CoachMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.aiData.coach_reply,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to get coach response";
        setError(errorMessage);

        const errorMsg: CoachMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            "I apologize, but I'm having trouble responding right now. Please try again.",
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const clearSession = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearSession,
    session,
    sessionId,
  };
}
