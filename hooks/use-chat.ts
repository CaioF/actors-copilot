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
  getDocs,
  setDoc,
  arrayUnion
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { ChatMessage, DNASession } from "@/lib/chat-types";
import { SECTION_INTROS } from "@/lib/prompts";
import {  DNASectionId } from "@/lib/chat-types";


const DEFAULT_SESSION_ID = "session-1";

interface ProgressAssessment {
  has_actionable_pattern: boolean;
  depth_score: number;
}

interface Milestone {
  event: string;
  emotional_cost: string;
  section: string;
  discoveredAt: string;
}

interface AIExtractions {
  new_traits?: string[];
  defense_mechanisms?: string[];
  leaf_snippets?: string[];
  holistic_analysis?: string;
  somatic_tells?: string[];
  core_values?: string[];
  relational_dynamics?: string[];
  milestones?: Milestone[];
  core_wounds_and_fears?: string[];
  unmet_needs?: string[];
  public_masks?: string[];
  emotional_baseline?: {
    conflict_response?: string;
    internal_friction?: string;
    vulnerability_management?: string;
  };
  intellectual_framework?: {
    cognitive_style?: string;
    attention_to_detail?: string;
  };
  archetype_signals?: string[];
  key_entities_and_arenas?: string[];
  progress_assessment?: ProgressAssessment; // Campo crucial para o progresso
}

interface ChatApiResponse {
  aiData: {
    coach_reply: string;
    extractions: AIExtractions | null;
    progress_assessment?: ProgressAssessment | null;
  };
  selectedQuestions: string[];
}

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
  const [isReprocessing, setIsReprocessing] = useState(false);

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
        setIsReprocessing(false);
        setStreamingContent("");

        // 1. Persist the sanitized user message to Firestore
        await addDoc(messagesRef, {
          role: "user",
          content: content.trim(),
          timestamp: serverTimestamp(),
          section: currentSection,
        });
        
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

        // THE RETRY ENGINE (SILENT REPROCESSING) ---
        let attempt = 0;
        const maxAttempts = 3;
        let success = false;
        
        let aiCoachReply = "";
        let aiExtractions: AIExtractions | null = null;
        let selectedQuestions: string[] = [];
        let aiAssessment: ProgressAssessment | null = null;

        while (attempt < maxAttempts && !success) {
            try {
                if (attempt > 0) {
                    setIsReprocessing(true);
                }

                // Execute Secure API Call to our Next.js backend
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
                const responseData = (await response.json()) as ChatApiResponse;
                
                // Validação de segurança para garantir que a IA não retornou um texto vazio
                if (!responseData?.aiData?.coach_reply) {
                    throw new Error("Empty or invalid response from AI");
                }

                aiCoachReply = responseData.aiData.coach_reply;
                aiExtractions = responseData.aiData.extractions || null;
                selectedQuestions = responseData.selectedQuestions || [];
                aiAssessment = responseData.aiData.progress_assessment ?? aiExtractions?.progress_assessment ?? null;

                success = true; 

            } catch (error) {
                attempt++;
                console.error(`Tentativa ${attempt} falhou silenciosamente:`, error);
                
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        if (!success) {
            await addDoc(messagesRef, {
                role: "assistant",
                content: "I lost my train of thought for a second there. Could you rephrase what you just said?",
                timestamp: serverTimestamp(),
                section: currentSection,
            });
            setIsReprocessing(false);
            setIsLoading(false);
            return; 
        }


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
        let newCompletedSecs = [...(session?.completedSections || [])]; 
        let sectionCounts = { ...(session?.sectionHqCounts || {}) };    
        let currentSecCount = sectionCounts[currentSection] || 0;

        if (aiExtractions) {
          totalCount += 1; 

          const isHighQuality =
            aiAssessment != null &&
            aiAssessment.has_actionable_pattern === true &&
            aiAssessment.depth_score >= 4;

          if (isHighQuality) {
            currentSecCount += 1; 
            sectionCounts[currentSection] = currentSecCount;

            if (currentSecCount >= 5 && !newCompletedSecs.includes(currentSection)) {
              newCompletedSecs.push(currentSection);
            }

            // --- THE MASTER PROFILE ARCHITECTURE ---
            const profileRef = doc(getDb(), `users/${userPath}/profile/master`);
            const updatePayload: Record<string, unknown> = { lastUpdated: serverTimestamp() };

            if (aiExtractions.new_traits && aiExtractions.new_traits?.length > 0) updatePayload['psychology.traits'] = arrayUnion(...aiExtractions.new_traits);
            if (aiExtractions.defense_mechanisms && aiExtractions.defense_mechanisms?.length > 0) updatePayload['psychology.defenseMechanisms'] = arrayUnion(...aiExtractions.defense_mechanisms);
            if (aiExtractions.leaf_snippets && aiExtractions.leaf_snippets?.length > 0) {
                const snippetsWithContext = aiExtractions.leaf_snippets.map((quote: string) => ({ quote, section: currentSection, timestamp: new Date().toISOString() }));
                updatePayload['psychology.leafSnippets'] = arrayUnion(...snippetsWithContext);
            }
            if (aiExtractions.holistic_analysis) updatePayload['psychology.analysisTimeline'] = arrayUnion({ inference: aiExtractions.holistic_analysis, section: currentSection, timestamp: new Date().toISOString() });
            if (aiExtractions.somatic_tells && aiExtractions.somatic_tells?.length > 0) updatePayload['physicality.somaticTells'] = arrayUnion(...aiExtractions.somatic_tells);
            if (aiExtractions.core_values && aiExtractions.core_values?.length > 0) updatePayload['psychology.coreValues'] = arrayUnion(...aiExtractions.core_values);
            if (aiExtractions.relational_dynamics && aiExtractions.relational_dynamics?.length > 0) updatePayload['psychology.relationalDynamics'] = arrayUnion(...aiExtractions.relational_dynamics);
            if (aiExtractions.milestones && aiExtractions.milestones?.length > 0) {
                const milestonesWithContext = aiExtractions.milestones.map((milestone: Milestone) => ({ ...milestone, section: currentSection, discoveredAt: new Date().toISOString() }));
                updatePayload['history.milestones'] = arrayUnion(...milestonesWithContext);
            }
            if (aiExtractions.core_wounds_and_fears && aiExtractions.core_wounds_and_fears?.length > 0) updatePayload['acting_fuel.coreWounds'] = arrayUnion(...aiExtractions.core_wounds_and_fears);
            if (aiExtractions.unmet_needs && aiExtractions.unmet_needs?.length > 0) updatePayload['acting_fuel.unmetNeeds'] = arrayUnion(...aiExtractions.unmet_needs);
            if (aiExtractions.public_masks && aiExtractions.public_masks?.length > 0) updatePayload['acting_fuel.publicMasks'] = arrayUnion(...aiExtractions.public_masks);

            if (aiExtractions.emotional_baseline) {
                if (aiExtractions.emotional_baseline.conflict_response) updatePayload['psychology.emotionalBaseline.conflictResponse'] = aiExtractions.emotional_baseline.conflict_response;
                if (aiExtractions.emotional_baseline.internal_friction) updatePayload['psychology.emotionalBaseline.internalFriction'] = aiExtractions.emotional_baseline.internal_friction;
                if (aiExtractions.emotional_baseline.vulnerability_management) updatePayload['psychology.emotionalBaseline.vulnerabilityManagement'] = aiExtractions.emotional_baseline.vulnerability_management;
            }
            if (aiExtractions.intellectual_framework) {
                if (aiExtractions.intellectual_framework.cognitive_style) updatePayload['psychology.intellectualFramework.cognitiveStyle'] = aiExtractions.intellectual_framework.cognitive_style;
                if (aiExtractions.intellectual_framework.attention_to_detail) updatePayload['psychology.intellectualFramework.attentionToDetail'] = aiExtractions.intellectual_framework.attention_to_detail;
            }

            if (aiExtractions.archetype_signals && aiExtractions.archetype_signals?.length > 0) updatePayload['acting_fuel.archetypes'] = arrayUnion(...aiExtractions.archetype_signals);
            if (aiExtractions.key_entities_and_arenas && aiExtractions.key_entities_and_arenas?.length > 0) updatePayload['history.keyEntities'] = arrayUnion(...aiExtractions.key_entities_and_arenas);
            
            await setDoc(profileRef, updatePayload, { merge: true });
          }
        }
        
        if (newCompletedSecs.length >= 4) unlockedAuditions = true;

        const TOTAL_SECTIONS = 12; 
        const EXTRACTIONS_TO_COMPLETE_SECTION = 12; 

        let totalProgressPercentage = 0;

        Object.values(sectionCounts).forEach(count => {
          const validExtractions = Math.min(count as number, EXTRACTIONS_TO_COMPLETE_SECTION);
          
          const sectionContribution = (validExtractions / EXTRACTIONS_TO_COMPLETE_SECTION) * (100 / TOTAL_SECTIONS);
          
          totalProgressPercentage += sectionContribution;
        });

        const newProgress = Math.round(Math.min(totalProgressPercentage, 100));

        const newAskedQuestions = [...previouslyAsked, ...(selectedQuestions || [])];

        const sessionRef = doc(getDb(), `users/${userPath}/dnaSessions/${sessionId}`);
        
        await setDoc(sessionRef, { 
          lastActiveAt: serverTimestamp(),
          totalExtractions: totalCount,
          sectionHqCounts: sectionCounts,
          progress: newProgress,           
          auditionsUnlocked: unlockedAuditions,
          askedQuestions: newAskedQuestions 
        }, { merge: true });
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unexpected session error";
        console.error("Fatal error out of retry loop:", errorMessage);
      } finally {
        setIsLoading(false);
        setIsReprocessing(false);
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
    await setDoc(sessionRef, { 
      currentSection: newSection,
      lastActiveAt: serverTimestamp()
    }, { merge: true });

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
    isReprocessing,
    streamingContent,
    isInitializing,
    firebaseAvailable,
  };
}