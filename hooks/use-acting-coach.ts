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
  arrayUnion,
} from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { CoachMessage, CoachSession } from "@/lib/chat-types";

const DEFAULT_SESSION_ID = "coach-session-1";

interface UseActingCoachReturn {
  messages: CoachMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, auditionId?: string) => Promise<void>;
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
            sessionFocus: null,
            stepIndex: 0,
            mode: null,
            phase: null,
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

      const trimmedContent = content.trim();

      setIsLoading(true);
      setError(null);

      if (userPath) {
        const messagesRef = collection(
          getDb(),
          `users/${userPath}/coachSessions/${sessionId}/messages`
        );

        const currentFocus = session
          ? {
              sessionFocus: session.sessionFocus ?? null,
              stepIndex: session.stepIndex ?? 0,
              mode: session.mode ?? null,
              phase: session.phase ?? null,
            }
          : null;

        const history = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        try {
          await addDoc(messagesRef, {
            role: "user",
            content: trimmedContent,
            timestamp: serverTimestamp(),
          });

          const auth = getAuth();
          const idToken = await auth.currentUser?.getIdToken();

          if (!idToken) {
            throw new Error("Authentication required");
          }

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
              currentFocus,
            }),
          });

          if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
          }

          const data = await response.json();

          if (!data?.aiData?.coach_reply) {
            throw new Error("Invalid response from coach");
          }

          await addDoc(messagesRef, {
            role: "assistant",
            content: data.aiData.coach_reply,
            timestamp: serverTimestamp(),
          });

          await updateDoc(
            doc(getDb(), `users/${userPath}/coachSessions/${sessionId}`),
            {
              lastActiveAt: serverTimestamp(),
              messageCount: increment(1),
              sessionFocus: data.aiData.session_focus,
              stepIndex: data.aiData.step_index,
              mode: data.aiData.mode,
              phase: data.aiData.phase,
            }
          );

          if (data.aiData.action?.type === "trigger_dna_extraction" && data.aiData.extractions) {
            const aiExtractions = data.aiData.extractions;
            const isHighQuality =
              aiExtractions.progress_assessment?.has_actionable_pattern === true &&
              (aiExtractions.progress_assessment?.depth_score ?? 0) >= 4;

            if (isHighQuality) {
              const profileRef = doc(getDb(), `users/${userPath}/profile/master`);
              const updatePayload: Record<string, unknown> = { lastUpdated: serverTimestamp() };

              if (aiExtractions.new_traits?.length) updatePayload["psychology.traits"] = arrayUnion(...aiExtractions.new_traits);
              if (aiExtractions.defense_mechanisms?.length) updatePayload["psychology.defenseMechanisms"] = arrayUnion(...aiExtractions.defense_mechanisms);
              if (aiExtractions.leaf_snippets?.length) {
                updatePayload["psychology.leafSnippets"] = arrayUnion(
                  ...aiExtractions.leaf_snippets.map((quote: string) => ({ quote, section: "identity", timestamp: new Date().toISOString() }))
                );
              }
              if (aiExtractions.holistic_analysis) {
                updatePayload["psychology.analysisTimeline"] = arrayUnion({
                  inference: aiExtractions.holistic_analysis, section: "identity", timestamp: new Date().toISOString()
                });
              }
              if (aiExtractions.somatic_tells?.length) updatePayload["physicality.somaticTells"] = arrayUnion(...aiExtractions.somatic_tells);
              if (aiExtractions.core_values?.length) updatePayload["psychology.coreValues"] = arrayUnion(...aiExtractions.core_values);
              if (aiExtractions.relational_dynamics?.length) updatePayload["psychology.relationalDynamics"] = arrayUnion(...aiExtractions.relational_dynamics);
              if (aiExtractions.milestones?.length) {
                updatePayload["history.milestones"] = arrayUnion(
                  ...aiExtractions.milestones.map((m: { event: string; emotional_cost: string }) => ({ ...m, section: "identity", discoveredAt: new Date().toISOString() }))
                );
              }
              if (aiExtractions.core_wounds_and_fears?.length) updatePayload["acting_fuel.coreWounds"] = arrayUnion(...aiExtractions.core_wounds_and_fears);
              if (aiExtractions.unmet_needs?.length) updatePayload["acting_fuel.unmetNeeds"] = arrayUnion(...aiExtractions.unmet_needs);
              if (aiExtractions.public_masks?.length) updatePayload["acting_fuel.publicMasks"] = arrayUnion(...aiExtractions.public_masks);
              if (aiExtractions.emotional_baseline?.conflict_response) updatePayload["psychology.emotionalBaseline.conflictResponse"] = aiExtractions.emotional_baseline.conflict_response;
              if (aiExtractions.emotional_baseline?.internal_friction) updatePayload["psychology.emotionalBaseline.internalFriction"] = aiExtractions.emotional_baseline.internal_friction;
              if (aiExtractions.emotional_baseline?.vulnerability_management) updatePayload["psychology.emotionalBaseline.vulnerabilityManagement"] = aiExtractions.emotional_baseline.vulnerability_management;
              if (aiExtractions.intellectual_framework?.cognitive_style) updatePayload["psychology.intellectualFramework.cognitiveStyle"] = aiExtractions.intellectual_framework.cognitive_style;
              if (aiExtractions.intellectual_framework?.attention_to_detail) updatePayload["psychology.intellectualFramework.attentionToDetail"] = aiExtractions.intellectual_framework.attention_to_detail;
              if (aiExtractions.archetype_signals?.length) updatePayload["acting_fuel.archetypes"] = arrayUnion(...aiExtractions.archetype_signals);
              if (aiExtractions.key_entities_and_arenas?.length) updatePayload["history.keyEntities"] = arrayUnion(...aiExtractions.key_entities_and_arenas);

              try {
                await setDoc(profileRef, updatePayload, { merge: true });
              } catch (writeErr) {
                console.error("Coach extraction profile write failed", writeErr);
              }
            }
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to get coach response";
          setError(errorMessage);

          try {
            await addDoc(messagesRef, {
              role: "assistant",
              content:
                "I apologize, but I'm having trouble responding right now. Please try again.",
              timestamp: serverTimestamp(),
            });
          } catch {
            // Silently accept — the error message is already in local state via setMessages.
          }
        } finally {
          setIsLoading(false);
        }
      } else {
        const userMsg: CoachMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          content: trimmedContent,
          timestamp: null,
        };

        setMessages((prev) => [...prev, userMsg]);

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
              content: trimmedContent,
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
            timestamp: null,
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
            timestamp: null,
          };
          setMessages((prev) => [...prev, errorMsg]);
        } finally {
          setIsLoading(false);
        }
      }
    },
    [messages, session, sessionId, userPath]
  );

  const startNewSession = useCallback(
    async (opts?: { linkedAuditionId?: string | null }) => {
      if (!userPath) return;
      const newSessionId = crypto.randomUUID();
      await setDoc(
        doc(getDb(), `users/${userPath}/coachSessions/${newSessionId}`),
        {
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
        }
      );
      setMessages([]);
      setError(null);
      setSessionId(newSessionId);
    },
    [userPath]
  );

  const clearSessionFocus = useCallback(async () => {
    if (!userPath) return;
    await updateDoc(
      doc(getDb(), `users/${userPath}/coachSessions/${sessionId}`),
      {
        sessionFocus: null,
        mode: null,
        stepIndex: 0,
        phase: null,
      }
    );
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
