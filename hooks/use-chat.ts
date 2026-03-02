"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { ChatMessage, DNASession } from "@/lib/chat-types";
import { SYSTEM_PROMPT, INTRO_MESSAGE } from "@/lib/chat-types";

const DEFAULT_USER_ID = "demo-user";
const DEFAULT_SESSION_ID = "session-1";

export function useChat(
  userId: string = DEFAULT_USER_ID,
  sessionId: string = DEFAULT_SESSION_ID
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [session, setSession] = useState<DNASession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
  const [firebaseAvailable, setFirebaseAvailable] = useState(true);

  // Check if Firebase is configured
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setFirebaseAvailable(false);
      setIsInitializing(false);
      // Load demo data
      setSession({
        id: DEFAULT_SESSION_ID,
        sessionNumber: 2,
        totalSessions: 7,
        currentSection: "introduction",
        progress: 10,
        lastActiveAt: null,
        durationMinutes: 18,
        createdAt: null,
        status: "active",
      });
      setMessages([
        {
          id: "intro-msg",
          role: "assistant",
          content: INTRO_MESSAGE,
          timestamp: null,
          section: "introduction",
        },
      ]);
      return;
    }
    setFirebaseAvailable(true);
  }, []);

  // Real-time listener for session metadata
  useEffect(() => {
    if (!firebaseAvailable) return;
    const sessionRef = doc(getDb(), `users/${userId}/dnaSessions/${sessionId}`);
    const unsubscribe = onSnapshot(
      sessionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setSession({ id: docSnap.id, ...docSnap.data() } as DNASession);
        } else {
          // Create the session document if it doesn't exist
          const defaultSession: Omit<DNASession, "id"> = {
            sessionNumber: 2,
            totalSessions: 7,
            currentSection: "introduction",
            progress: 10,
            lastActiveAt: serverTimestamp() as DNASession["lastActiveAt"],
            durationMinutes: 18,
            createdAt: serverTimestamp() as DNASession["createdAt"],
            status: "active",
          };
          void setDoc(sessionRef, defaultSession);
        }
      },
      () => {
        // On error, fallback to demo mode
        setFirebaseAvailable(false);
        setSession({
          id: DEFAULT_SESSION_ID,
          sessionNumber: 2,
          totalSessions: 7,
          currentSection: "introduction",
          progress: 10,
          lastActiveAt: null,
          durationMinutes: 18,
          createdAt: null,
          status: "active",
        });
        setMessages([
          {
            id: "intro-msg",
            role: "assistant",
            content: INTRO_MESSAGE,
            timestamp: null,
            section: "introduction",
          },
        ]);
        setIsInitializing(false);
      }
    );
    return () => unsubscribe();
  }, [userId, sessionId, firebaseAvailable]);

  // Real-time listener for messages
  useEffect(() => {
    if (!firebaseAvailable) return;
    const messagesRef = collection(
      getDb(),
      `users/${userId}/dnaSessions/${sessionId}/messages`
    );
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const msgs = snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...d.data(),
            }) as ChatMessage
        );

        // Seed intro message if empty
        if (msgs.length === 0) {
          await addDoc(messagesRef, {
            role: "assistant",
            content: INTRO_MESSAGE,
            timestamp: serverTimestamp(),
            section: "introduction",
          });
        } else {
          setMessages(msgs);
        }
        setIsInitializing(false);
      },
      () => {
        // On error, fallback
        setFirebaseAvailable(false);
        setMessages([
          {
            id: "intro-msg",
            role: "assistant",
            content: INTRO_MESSAGE,
            timestamp: null,
            section: "introduction",
          },
        ]);
        setIsInitializing(false);
      }
    );
    return () => unsubscribe();
  }, [userId, sessionId, firebaseAvailable]);

  // Send message
  const sendMessage = useCallback(
    async (content: string, activeSection?: string) => {
      if (!content.trim()) return;

      const currentSection = activeSection ?? session?.currentSection ?? "introduction";

      if (!firebaseAvailable) {
        // Demo mode: add messages locally
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          content: content.trim(),
          timestamp: null,
          section: currentSection,
        };
        setMessages((prev) => [...prev, userMsg]);
        setIsLoading(true);

        // Simulate AI response
        setTimeout(() => {
          const aiMsg: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: "assistant",
            content:
              "Good. That is a start. But I need you to go deeper. When you think about that moment, what was the first physical sensation? Not the emotion — the sensation. Where did you feel it in your body? What was the temperature of the room? What could you hear in the background? Give me the specifics that make this yours and no one else's.",
            timestamp: null,
            section: currentSection,
          };
          setMessages((prev) => [...prev, aiMsg]);
          setIsLoading(false);
        }, 1500);
        return;
      }

      const db = getDb();
      const messagesRef = collection(
        db,
        `users/${userId}/dnaSessions/${sessionId}/messages`
      );

      // Write user message to Firestore
      await addDoc(messagesRef, {
        role: "user",
        content: content.trim(),
        timestamp: serverTimestamp(),
        section: currentSection,
      });

      setIsLoading(true);
      setStreamingContent("");

      try {
        // Use Firebase AI Logic (Gemini Developer API) via client-side SDK
        const { getAI, getGenerativeModel, GoogleAIBackend } = await import(
          "firebase/ai"
        );
        const { getApp: getFirebaseApp } = await import("@/lib/firebase");
        const ai = getAI(getFirebaseApp(), { backend: new GoogleAIBackend() });
        const model = getGenerativeModel(ai, { model: "gemini-2.0-flash" });

        // Build conversation history
        const currentMessages = await getDocs(
          query(messagesRef, orderBy("timestamp", "asc"))
        );
        const history = currentMessages.docs
          .filter((d) => d.data().role !== undefined)
          .map((d) => ({
            role: d.data().role === "assistant" ? ("model" as const) : ("user" as const),
            parts: [{ text: d.data().content as string }],
          }));

        // Remove the last entry (the user message we just added) since we pass it as the new message
        const chatHistory = history.slice(0, -1);

        const chat = model.startChat({
          systemInstruction: { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
          history: chatHistory,
        });

        const result = await chat.sendMessageStream(content.trim());
        let fullResponse = "";

        for await (const chunk of result.stream) {
          const text = chunk.text();
          fullResponse += text;
          setStreamingContent(fullResponse);
        }

        // Persist complete AI response
        await addDoc(messagesRef, {
          role: "assistant",
          content: fullResponse,
          timestamp: serverTimestamp(),
          section: currentSection,
        });

        // Update session metadata
        const sessionRef = doc(
          getDb(),
          `users/${userId}/dnaSessions/${sessionId}`
        );
        await updateDoc(sessionRef, {
          lastActiveAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("AI response error:", error);
        // Fallback: write a static response
        await addDoc(messagesRef, {
          role: "assistant",
          content:
            "I encountered an issue generating a response. Let us continue — tell me more about what you were describing.",
          timestamp: serverTimestamp(),
          section: currentSection,
        });
      } finally {
        setIsLoading(false);
        setStreamingContent("");
      }
    },
    [userId, sessionId, session, firebaseAvailable]
  );

  return {
    messages,
    session,
    sendMessage,
    isLoading,
    streamingContent,
    isInitializing,
    firebaseAvailable,
  };
}
