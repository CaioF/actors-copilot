"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
import type { FlightPlanStage } from "@/lib/acting-coach/contracts";
import { createChildLogger } from "@/lib/logger";
import type { AttachedDocument } from "@/components/chat-input";

const log = createChildLogger({ module: "CoachExtraction" });
const DEFAULT_SESSION_ID = "coach-session-1";

interface UseActingCoachReturn {
  messages: CoachMessage[];
  isLoading: boolean;
  error: string | null;
  /**
   * Sends a message to the AI coach, optionally including audition context, coachType, and targetStage.
   */
  sendMessage: (
    content: string, 
    auditionId?: string, 
    document?: AttachedDocument | null,
    opts?: { coachType?: "general" | "character"; targetStage?: FlightPlanStage }
  ) => Promise<void>;
  startNewSession: (opts?: { linkedAuditionId?: string | null; coachType?: "general" | "character" }) => Promise<void>;
  clearSessionFocus: () => Promise<void>;
  switchSession: (id: string) => void;
  selectStage: (stageNumber: number) => Promise<void>;
  setCoachType: (type: "general" | "character") => Promise<void>;
  session: CoachSession | null;
  sessions: CoachSession[];
  sessionId: string;
  /** True until Firebase auth has finished loading. Use to gate auto-trigger effects. */
  isAuthLoading: boolean;
  /** True when auth has loaded and the user is signed in (userPath is non-null). */
  isAuthenticated: boolean;
}

export function useActingCoach(): UseActingCoachReturn {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(DEFAULT_SESSION_ID);
  const [userPath, setUserPath] = useState<string | null>(null);
  const [session, setSession] = useState<CoachSession | null>(null);
  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const hasAutoSelectedSession = useRef(false);

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
          coachType: "general",
          currentStage: 1,
          completedStages: [],
          flightPlanMode: "guided",
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

  // --- Sessions List Listener (for picker + auto-select most recent) ---
  useEffect(() => {
    if (!isFirebaseConfigured() || isAuthLoading || !userPath) return;

    const sessionsRef = collection(getDb(), `users/${userPath}/coachSessions`);
    const q = query(sessionsRef, orderBy("lastActiveAt", "desc"));

    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<CoachSession, "id">) }),
      );
      setSessions(list);

      // On first load, switch to the most recent session if one exists.
      if (!hasAutoSelectedSession.current && list.length > 0) {
        hasAutoSelectedSession.current = true;
        if (list[0].id !== sessionId) {
          setMessages([]);
          setSessionId(list[0].id);
        }
      }
    }, () => setSessions([]));
  }, [userPath, isAuthLoading]);

  // --- Core Message Logic ---
  const sendMessage = useCallback(
    async (
      content: string, 
      auditionId?: string, 
      document?: AttachedDocument | null,
      opts?: { coachType?: "general" | "character"; targetStage?: FlightPlanStage }
    ) => {
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
            ...(document ? { documentName: document.name } : {}),
          });
        }

        const resolvedCoachType = opts?.coachType || session?.coachType || (auditionId ? "character" : "general");

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
            coachType: resolvedCoachType,
            targetStage: opts?.targetStage,
            currentFocus: session?.sessionFocus != null ? {
              sessionFocus: session.sessionFocus,
              stepIndex: session.stepIndex,
              mode: session.mode,
              phase: session.phase,
              currentStage: session.currentStage ?? 1,
              completedStages: session.completedStages ?? [],
              flightPlanMode: session.flightPlanMode ?? "guided",
            } : null,
            document: document || undefined,
          }),
        });

        if (!response.ok) {
          let serverError = "";
          try {
            const errBody = await response.json();
            if (errBody && typeof errBody.error === "string") serverError = errBody.error;
          } catch {
            // response body wasn't JSON; fall through
          }
          throw new Error(serverError || `Request failed: ${response.status}`);
        }
        const data = await response.json();
        if (!data?.aiData?.coach_reply) throw new Error("Invalid response from coach");

        // 3. Handle Firestore write operations concurrently
        if (userPath) {
          const sessionRef = doc(getDb(), `users/${userPath}/coachSessions/${sessionId}`);
          const messagesRef = collection(sessionRef, "messages");
          const dbPromises: Promise<unknown>[] = [];

          // Add assistant message
          dbPromises.push(
            addDoc(messagesRef, {
              role: "assistant",
              content: data.aiData.coach_reply,
              timestamp: serverTimestamp(),
            })
          );

          // Update session metadata
          dbPromises.push(
            updateDoc(sessionRef, {
              lastActiveAt: serverTimestamp(),
              messageCount: increment(1),
              sessionFocus: data.aiData.session_focus ?? null,
              stepIndex: data.aiData.step_index ?? 0,
              mode: data.aiData.mode ?? null,
              phase: data.aiData.phase ?? null,
              coachType: resolvedCoachType,
              currentStage: data.aiData.current_stage ?? session?.currentStage ?? 1,
              completedStages: data.aiData.completed_stages ?? session?.completedStages ?? [],
              flightPlanMode: data.aiData.flight_plan_mode ?? session?.flightPlanMode ?? "guided",
              ...(data.aiData.audition_plan ? { auditionPlan: data.aiData.audition_plan } : {}),
              ...(typeof data.aiData.sides_text === "string" ? { sidesText: data.aiData.sides_text } : {}),
            })
          );

          // Handle DNA Extraction Quality Gate
          if (data.aiData.action?.type === "trigger_dna_extraction" && data.aiData.extractions) {
            const aiExtractions = data.aiData.extractions;
            const isHighQuality =
              aiExtractions.progress_assessment?.has_actionable_pattern === true &&
              (aiExtractions.progress_assessment?.depth_score ?? 0) >= 4;

            if (isHighQuality) {
              const profileRef = doc(getDb(), `users/${userPath}/profile/master`);
              const updatePayload: Record<string, any> = { lastUpdated: serverTimestamp() };

              if (aiExtractions.new_traits?.length) updatePayload["psychology.traits"] = arrayUnion(...aiExtractions.new_traits);
              if (aiExtractions.core_values?.length) updatePayload["psychology.coreValues"] = arrayUnion(...aiExtractions.core_values);
              if (aiExtractions.somatic_tells?.length) updatePayload["physicality.somaticTells"] = arrayUnion(...aiExtractions.somatic_tells);

              dbPromises.push(
                setDoc(profileRef, updatePayload, { merge: true }).then(() => {
                  log.debug("Coach extraction written to profile/master");
                })
              );
            }
          }

          // Handle Profile Update Action
          if (data.aiData.action?.type === "update_actor_profile" && data.aiData.action?.payload) {
            const auth = getAuth();
            const uid = auth.currentUser?.uid;
            if (uid) {
              const COACH_WRITABLE_FIELDS = new Set([
                "headshot", "additionalPhotos", "playingAgeMin", "playingAgeMax",
                "location", "gender", "height", "heightUnit", "eyeColour", "hairColour",
                "nationalities", "ethnicity", "appearance", "awardsCallout", "bio",
                "showreels", "credits", "training", "skillsAndAccents",
              ]);
              const rawPayload = data.aiData.action.payload as Record<string, unknown>;
              const safePayload: Record<string, unknown> = { lastUpdated: serverTimestamp() };
              for (const [key, value] of Object.entries(rawPayload)) {
                if (COACH_WRITABLE_FIELDS.has(key)) {
                  safePayload[key] = value;
                }
              }
              if (Object.keys(safePayload).length > 1) {
                dbPromises.push(
                  setDoc(doc(getDb(), "actorProfiles", uid), safePayload, { merge: true }).catch((writeError) => {
                    log.error({ err: writeError, msg: "Coach profile write failed" });
                  })
                );
              }
            }
          }

          await Promise.all(dbPromises);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to get coach response";
        setError(message);

        if (userPath) {
          try {
            const messagesRef = collection(getDb(), `users/${userPath}/coachSessions/${sessionId}/messages`);
            await addDoc(messagesRef, {
              role: "assistant",
              content: `Sorry, something went wrong: ${message}. Please try again.`,
              timestamp: serverTimestamp(),
            });
          } catch (writeErr) {
            log.debug({ err: writeErr }, "Failed to write error message to chat");
          }
        }
      } finally {
        setIsLoading(false);
      }
    },
    [messages, session, sessionId, userPath]
  );

  const startNewSession = useCallback(
    async (opts?: { linkedAuditionId?: string | null; coachType?: "general" | "character" }) => {
      if (!userPath) return;
      const newSessionId = crypto.randomUUID();
      const type = opts?.coachType || (opts?.linkedAuditionId ? "character" : "general");
      await setDoc(doc(getDb(), `users/${userPath}/coachSessions/${newSessionId}`), {
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        status: "active",
        title: type === "character" ? "Character Coach Session" : "General Coach Session",
        linkedAuditionId: opts?.linkedAuditionId ?? null,
        messageCount: 0,
        sessionFocus: null,
        stepIndex: 0,
        mode: null,
        phase: null,
        coachType: type,
        currentStage: 1,
        completedStages: [],
        flightPlanMode: "guided",
      });
      hasAutoSelectedSession.current = true;
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

  const switchSession = useCallback((id: string) => {
    if (!id || id === sessionId) return;
    hasAutoSelectedSession.current = true;
    setMessages([]);
    setError(null);
    setSessionId(id);
  }, [sessionId]);

  const selectStage = useCallback(async (stageNumber: number) => {
    if (!userPath || !sessionId) return;
    await updateDoc(doc(getDb(), `users/${userPath}/coachSessions/${sessionId}`), {
      currentStage: stageNumber,
      flightPlanMode: "menu",
      sessionFocus: `Stage ${stageNumber}`,
    });
  }, [userPath, sessionId]);

  const setCoachType = useCallback(async (type: "general" | "character") => {
    if (!userPath || !sessionId) return;
    await updateDoc(doc(getDb(), `users/${userPath}/coachSessions/${sessionId}`), {
      coachType: type,
    });
  }, [userPath, sessionId]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    startNewSession,
    clearSessionFocus,
    switchSession,
    selectStage,
    setCoachType,
    session,
    sessions,
    sessionId,
    isAuthLoading,
    isAuthenticated: !isAuthLoading && userPath !== null,
  };
}