"use client";

import { useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import type { AttachedDocument } from "@/components/chat-input";

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UseActingCoachReturn {
  messages: CoachMessage[];
  isLoading: boolean;
  error: string | null;
  /**
   * Sends a message to the AI coach, optionally including audition context and an attached document.
   */
  sendMessage: (content: string, auditionId?: string, document?: AttachedDocument | null) => Promise<void>;
  clearSession: () => void;
}

export function useActingCoach(): UseActingCoachReturn {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string, auditionId?: string, document?: AttachedDocument | null) => {
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
            document: document || undefined,
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
  };
}