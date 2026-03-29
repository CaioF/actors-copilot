"use client";

import { useState, useEffect, useCallback } from "react";
import { where, limit } from "firebase/firestore";
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

import { getAuth, onAuthStateChanged } from "firebase/auth";

import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { ChatMessage, DNASession } from "@/lib/chat-types";
import { SECTION_INTROS } from "@/lib/prompts";
import {  DNASectionId } from "@/lib/chat-types";


const DEFAULT_SESSION_ID = "session-1";

/**
 * Custom React hook to manage the AI Copilot DNA Extraction chat session.
 * Handles real-time synchronization with Firebase Firestore, interactions with
 * the Vertex AI Gemini model, and local state management for the chat UI.
 *
 * @param {string} userPath - The unique identifier of the user.
 * @param {string} sessionId - The unique identifier of the current DNA extraction session.
 * @returns {Object} The chat state and action methods.
 */
export function useChat( sessionId: string = DEFAULT_SESSION_ID ) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [session, setSession] = useState<DNASession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
  const [firebaseAvailable, setFirebaseAvailable] = useState(true);

  //Handle Authentication and the customized Firestore path
  const [userPath, setUserPath] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  /**
   * Validates Firebase configuration on mount.
   * If Firebase is not configured, it falls back to a mocked state for UI demonstration purposes.
   */
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setFirebaseAvailable(false);
      setIsInitializing(false);
      setSession({
        id: DEFAULT_SESSION_ID,
        sessionNumber: 2,
        totalSessions: 7,
        currentSection: "identity",
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
          content: SECTION_INTROS["identity"],
          timestamp: null,
          section: "identity",
        },
      ]);
      return;
    }
    setFirebaseAvailable(true);
  }, []);

  /**
   * AUTHENTICATION LISTENER
   * Listens for the currently logged-in user and creates a readable Firestore path.
   */
  useEffect(() => {
    if (!firebaseAvailable) return;
    const auth = getAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Extract the first name and remove special characters for a safe database path
        const firstName = user.displayName 
          ? user.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") 
          : "Actor";
        
        // Combine UID and First Name (e.g., "12345abc_Gabrielli") 
        // This makes it unique for security, but readable in the Firestore Console
        setUserPath(`${user.uid}_${firstName}`);
      } else {
        setUserPath(null); // User is not logged in
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseAvailable]);

  /**
   * Establishes a real-time Firestore listener for session metadata.
   * Automatically provisions a default session document if one does not exist.
   */
  useEffect(() => {
    if (!firebaseAvailable || isAuthLoading || !userPath) return;
    const sessionRef = doc(getDb(), `users/${userPath}/dnaSessions/${sessionId}`);
    const unsubscribe = onSnapshot(
      sessionRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setSession({ id: docSnap.id, ...docSnap.data() } as DNASession);
        } else {
          const defaultSession: Omit<DNASession, "id"> = {
            sessionNumber: 2,
            totalSessions: 7,
            currentSection: "identity",
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
        setFirebaseAvailable(false);
        setSession({
          id: DEFAULT_SESSION_ID,
          sessionNumber: 2,
          totalSessions: 7,
          currentSection: "identity",
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
            content: SECTION_INTROS["identity"],
            timestamp: null,
            section: "identity",
          },
        ]);
        setIsInitializing(false);
      }
    );
    return () => unsubscribe();
  }, [userPath, sessionId, isAuthLoading, firebaseAvailable]);

  /**
   * Establishes a real-time Firestore listener for chat messages in the current session.
   * Automatically injects an initial greeting from the assistant if the chat history is empty.
   */
  useEffect(() => {
    if (!firebaseAvailable) return;
    const messagesRef = collection(
      getDb(),
      `users/${userPath}/dnaSessions/${sessionId}/messages`
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

        if (msgs.length === 0) {
          await addDoc(messagesRef, {
            role: "assistant",
            content: SECTION_INTROS["identity"],
            timestamp: serverTimestamp(),
            section: "identity",
          });
        } else {
          setMessages(msgs);
        }
        setIsInitializing(false);
      },
      () => {
        setFirebaseAvailable(false);
        setMessages([
          {
            id: "intro-msg",
            role: "assistant",
            content: SECTION_INTROS["identity"],
            timestamp: null,
            section: "identity",
          },
        ]);
        setIsInitializing(false);
      }
    );
    return () => unsubscribe();
  }, [userPath, sessionId, isAuthLoading, firebaseAvailable]);

  /**
   * Processes and dispatches a user message to the AI model, then handles the structured response.
   * Calculates progress based on the quality of AI extractions and updates session metadata.
   *
   * @param {string} content - The user's input text.
   * @param {string} [activeSection] - The specific DNA section currently active in the UI.
   * @returns {Promise<void>}
   */
  const sendMessage = useCallback(
    async (content: string, activeSection?: string) => {
      if (!content.trim()) return;

      const currentSection = activeSection ?? session?.currentSection ?? "identity";

      // Mock behavior for missing Firebase config
      if (!firebaseAvailable) {
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          content: content.trim(),
          timestamp: null,
          section: currentSection,
        };
        setMessages((prev) => [...prev, userMsg]);
        setIsLoading(true);

        setTimeout(() => {
          const aiMsg: ChatMessage = {
            id: `ai-${Date.now()}`,
            role: "assistant",
            content:
              "Good. That is a start. But I need you to go deeper. When you think about that moment, what was the first physical behaviour you noted? Blushing, tight shoulders, shortness of breath? Describe that outcome in detail.",
            timestamp: null,
            section: currentSection,
          };
          setMessages((prev) => [...prev, aiMsg]);
          setIsLoading(false);
        }, 1500);
        return;
      }

      // TODO: Security/Architecture Improvement: Consider migrating the Vertex AI initialization and prompt execution to a secure Next.js API route or Firebase Cloud Function. Executing AI logic client-side exposes your system prompts and structural logic to the browser.
      
      const db = getDb();
      const messagesRef = collection(
        db,
        `users/${userPath}/dnaSessions/${sessionId}/messages`
      );

      try {
        setIsLoading(true);
        setStreamingContent("");

        // 1. Persist the sanitized user message to Firestore
        await addDoc(messagesRef, {
          role: "user",
          content: content.trim(),
          timestamp: serverTimestamp(),
          section: currentSection,
        });

        // 2. Initialize the Vertex AI Gemini model
        // 2. Prepare the history payload for the secure backend
        const currentMessages = await getDocs(
          query(messagesRef, orderBy("timestamp", "asc"))
        );

        // Extract and map the conversation history
        const history = currentMessages.docs
          .filter((d) => d.data().role !== undefined)
          .map((d) => ({
            role: d.data().role === "assistant" ? ("model" as const) : ("user" as const),
            parts: [{ text: (d.data().content as string) || ""}],
          }));

        // The Gemini API requires strictly alternating 'user' and 'model' roles.
        // We compile the history excluding the current message.
        const historyWithoutCurrent = history.slice(0, -1);
        const chatHistory: { role: "user" | "model"; parts: { text: string }[] }[] = [];
        let expectedRole = "user"; 

        for (const msg of historyWithoutCurrent) {
          if (msg.role === expectedRole) {
            chatHistory.push(msg);
            expectedRole = expectedRole === "user" ? "model" : "user";
          } else {
            // Merge consecutive messages to maintain strict alternating roles
            if (chatHistory.length > 0) {
              chatHistory[chatHistory.length - 1].parts[0].text += `\n\n${msg.parts[0].text}`;
            }
          }
        }

        const auth = getAuth();
        const actorName = auth.currentUser?.displayName?.split(" ")[0] || "Actor";
        
        // Retrieve the secure Firebase ID token for backend authentication
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Authentication token not found.");

        const previouslyAsked: string[] = session?.askedQuestions || [];

        // 3. Execute Secure API Call to our Next.js backend
        const response = await fetch('/api/dna/chat', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: content.trim(),
            currentSection,
            actorName,
            history: chatHistory,
            previouslyAsked
          })
        });

        if (!response.ok) {
           throw new Error(`Server responded with status: ${response.status}`);
        }

        // 4. Parse the secure response
        const { aiData, selectedQuestions } = await response.json();

        // Safely extract fields from the backend response
        const aiCoachReply = aiData?.coach_reply || "I encountered an issue generating a response. Let us continue.";
        const aiExtractions = aiData?.extractions || null;
        const aiAssessment = aiData?.progress_assessment || aiData?.extractions?.progress_assessment || null;

        // 6. Persist only the AI's conversational reply to the visible chat history
        await addDoc(messagesRef, {
          role: "assistant",
          content: aiCoachReply,
          timestamp: serverTimestamp(),
          section: currentSection,
        });

        // Progress Calculation & Logic
        let unlockedAuditions = session?.auditionsUnlocked || false;
        let totalCount = session?.totalExtractions || 0;
        let newCompletedSecs = [...(session?.completedSections || [])]; // Shallow copy array
        let sectionCounts = { ...(session?.sectionHqCounts || {}) };    // Shallow copy object
        let currentSecCount = sectionCounts[currentSection] || 0;

        if (aiExtractions) {
          totalCount += 1; 

          if (aiExtractions.progress_assessment) {
            delete aiExtractions.progress_assessment;
          }

          // Archive high-value extractions into a dedicated user vault collection
          const vaultRef = collection(getDb(), `users/${userPath}/dnaVault`);
          await addDoc(vaultRef, {
            sessionId: sessionId,
            section: currentSection,
            timestamp: serverTimestamp(),
            extractions: aiExtractions,
            assessment: aiAssessment 
          });

          // Evaluate extraction quality to determine progression
          const isHighQuality =
            aiAssessment != null &&
            aiAssessment.has_actionable_pattern === true &&
            aiAssessment.depth_score >= 5;

          if (isHighQuality) {
            currentSecCount += 1; 
            sectionCounts[currentSection] = currentSecCount; // Store updated count for current section

            // Mark section as completed if the required threshold (5) of high-quality insights is met
            if (currentSecCount >= 5 && !newCompletedSecs.includes(currentSection)) {
              newCompletedSecs.push(currentSection);
            }
          }
        }
        
        if (newCompletedSecs.length >= 4) {
          unlockedAuditions = true;
        }

        // Global Progress Bar Calculation (0% to 100%)
        // The goal is to accumulate 24 high-quality extractions across sections.
        // Math.min ensures individual section over-performance doesn't erroneously inflate the total cap.
        const totalPepitasUteis = Object.values(sectionCounts).reduce(
            (acc, count) => acc + Math.min(count as number, 6), 0
        );
        const newProgress = Math.round(Math.min((totalPepitasUteis / 24) * 100, 100));

        // Combine the previously asked questions with the newly selected ones returned from the server
        const newAskedQuestions = [...previouslyAsked, ...(selectedQuestions || [])];

        // Synchronize calculated progress and session metrics back to Firestore
        const sessionRef = doc(getDb(), `users/${userPath}/dnaSessions/${sessionId}`);
        await updateDoc(sessionRef, { 
          lastActiveAt: serverTimestamp(),
          totalExtractions: totalCount,
          sectionHqCounts: sectionCounts,
          progress: newProgress,           
          auditionsUnlocked: unlockedAuditions,
          askedQuestions: newAskedQuestions
        });
        
      } catch (error) {
        console.error("AI response error:", error);
        
        // Provide a graceful fallback response if AI inference fails
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
    [userPath, sessionId, session, firebaseAvailable]
  );

  /**
   * Updates the currently active DNA section in Firestore and synchronizes the UI.
   * Automatically injects the contextual introductory message if the newly opened section is empty.
   *
   * @param {string} newSection - The identifier of the section being navigated to.
   * @returns {Promise<void>}
   */
  const changeSection = useCallback(async (newSection: string) => {
    if (!firebaseAvailable || !session) return;
    
    const sessionRef = doc(getDb(), `users/${userPath}/dnaSessions/${sessionId}`);
    await updateDoc(sessionRef, { 
      currentSection: newSection,
      lastActiveAt: serverTimestamp()
    });

    // Check for existing messages in the target section
    const messagesRef = collection(getDb(), `users/${userPath}/dnaSessions/${sessionId}/messages`);
    const q = query(messagesRef, where("section", "==", newSection), limit(1));
    const snapshot = await getDocs(q);

    // Inject the domain-specific introductory prompt if the section is completely empty
    if (snapshot.empty) {
      const introText = SECTION_INTROS[newSection as DNASectionId];
      if (introText) {
        await addDoc(messagesRef, {
          role: "assistant",
          content: introText,
          timestamp: serverTimestamp(),
          section: newSection,
        });
      }
    }
  }, [userPath, sessionId, session, firebaseAvailable]);

  return {
    messages,
    session,
    sendMessage,
    changeSection,
    isLoading,
    streamingContent,
    isInitializing,
    firebaseAvailable,
  };
}