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

import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { ChatMessage, DNASession } from "@/lib/chat-types";
// Add this new import at the top of your use-chat.ts file
import { QUESTIONS } from "@/lib/question";
import { SYSTEM_PROMPT, SECTION_INTROS, DNASectionId } from "@/lib/chat-types";

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
  }, [userId, sessionId, firebaseAvailable]);

  // Send message
  const sendMessage = useCallback(
    async (content: string, activeSection?: string) => {
      if (!content.trim()) return;

      const currentSection = activeSection ?? session?.currentSection ?? "identity";

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

      const db = getDb();
      const messagesRef = collection(
        db,
        `users/${userId}/dnaSessions/${sessionId}/messages`
      );

      try {
        setIsLoading(true);
        setStreamingContent("");

        // 1. Salva a mensagem limpa do usuário no banco
        await addDoc(messagesRef, {
          role: "user",
          content: content.trim(),
          timestamp: serverTimestamp(),
          section: currentSection,
        });

        // 2. Prepara o modelo com Firebase AI
        const { getAI, getGenerativeModel, VertexAIBackend } = await import("firebase/ai");
        const { getApp: getFirebaseApp } = await import("@/lib/firebase");

        const ai = getAI(getFirebaseApp(), { backend: new VertexAIBackend() });
        const model = getGenerativeModel(ai, { 
          model: "gemini-2.0-flash",
          // ADIÇÃO: Forçando o output estruturado
          generationConfig: { 
            responseMimeType: "application/json",
            temperature: 0.3
          }
        });

        // 3. Monta o Histórico
        const currentMessages = await getDocs(
          query(messagesRef, orderBy("timestamp", "asc"))
        );
        const history = currentMessages.docs
          .filter((d) => d.data().role !== undefined)
          .map((d) => ({
            role: d.data().role === "assistant" ? ("model" as const) : ("user" as const),
            parts: [{ text: d.data().content as string || ""}],
          }));

        const historyWithoutCurrent = history.slice(0, -1);

        const chatHistory: { role: "user" | "model"; parts: { text: string }[] }[] = [];
        let expectedRole = "user"; // O Gemini exige que comece SEMPRE com 'user'

        for (const msg of historyWithoutCurrent) {
          if (msg.role === expectedRole) {
            // Se é o turno certo, adiciona na lista e inverte a expectativa
            chatHistory.push(msg);
            expectedRole = expectedRole === "user" ? "model" : "user";
          } else {
            // Se veio repetido (ex: duas mensagens do Coach seguidas por causa da introdução),
            // fundimos o texto na última mensagem para não quebrar a regra da IA.
            if (chatHistory.length > 0) {
              chatHistory[chatHistory.length - 1].parts[0].text += `\n\n${msg.parts[0].text}`;
            }
          }
        }

        const chat = model.startChat({
          systemInstruction: { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
          history: chatHistory,
        });

        //questions selection
        // 1. Fetch all questions for the current section (Array of strings)
        const allSectionQuestions: string[] = QUESTIONS[currentSection] || [];

        // 2. Get the list of already used questions from the session (fallback to empty array)
        // Ensure you declare this variable before the AI call
        const previouslyAsked: string[] = session?.askedQuestions || [];

        // 3. Filter out the questions that are already in the 'previouslyAsked' list
        // Explicitly typing 'q: string' fixes the TypeScript TS(7006) error
        const availableQuestions = allSectionQuestions.filter((q: string) => !previouslyAsked.includes(q));

        // 4. Shuffle the remaining questions and pick up to 3
        const shuffledQuestions = [...availableQuestions].sort(() => 0.5 - Math.random());
        const selectedQuestions = shuffledQuestions.slice(0, 3);

        // 5. Format them into a text list for the AI prompt
        const questionsListText = selectedQuestions.map((q: string) => `- ${q}`).join("\n");

        const finalPromptForAI = `[CURRENT EXPLORATION ARENA: ${currentSection.toUpperCase()}]\nKeep your tone and extractions strictly focused on this arena.\n\nActor's Input: "${content.trim()}"\n\nSuggested Thematic Directions (Use these as inspiration...):\n${questionsListText}`;

        // 5. Chamada Simples (Sem Stream) para receber o JSON completo
        const result = await chat.sendMessage(finalPromptForAI);
        const fullResponse = result.response.text();
        
        console.log("🔍 1. TEXTO CRU DA IA:", fullResponse);
        
        const aiData = JSON.parse(fullResponse);
        
        console.log("🧩 2. JSON MONTADO:", aiData);
        
        // Tratamento de segurança (Fallback)
        const aiCoachReply = aiData?.coach_reply || "I encountered an issue generating a response. Let us continue.";
        const aiExtractions = aiData?.extractions || null;
        const aiAssessment = aiData?.progress_assessment || aiData?.extractions?.progress_assessment || null; //depth grade

        // 6. Salva apenas a fala do Coach no chat visível
        await addDoc(messagesRef, {
          role: "assistant",
          content: aiCoachReply,
          timestamp: serverTimestamp(),
          section: currentSection,
        });

        //progress 
        let unlockedAuditions = session?.auditionsUnlocked || false;
        let totalCount = session?.totalExtractions || 0;
        let newCompletedSecs = [...(session?.completedSections || [])]; // Copys array
        let sectionCounts = { ...(session?.sectionHqCounts || {}) };    // Copys object
        let currentSecCount = sectionCounts[currentSection] || 0;

        if (aiExtractions ) {
          totalCount += 1; 

          
          if (aiExtractions.progress_assessment) {
            delete aiExtractions.progress_assessment;
          }

        // saves all extractions in a vault collection for future use
          const vaultRef = collection(getDb(), `users/${userId}/dnaVault`);
          await addDoc(vaultRef, {
            sessionId: sessionId,
            section: currentSection,
            timestamp: serverTimestamp(),
            extractions: aiExtractions,
            assessment: aiAssessment 
          });

          // quality check 
          const isHighQuality = aiAssessment.has_actionable_pattern === true && aiAssessment.depth_score >= 6;

          if (isHighQuality) {
            currentSecCount += 1; 
            sectionCounts[currentSection] = currentSecCount; // save the count for the current section

            //if the user extracted 6 good insights in the same section, we consider it completed and move on to the next one
            if (currentSecCount >= 6 && !newCompletedSecs.includes(currentSection)) {
              newCompletedSecs.push(currentSection);
            }
          }
        }
        
        if (newCompletedSecs.length >= 4) {
          unlockedAuditions = true;
        }

        // BAR CALCULATION (0% to 100%)
        // The bar starts at 0%. The goal is to accumulate 24 high-quality extractions.
        // We use Math.min to ensure the bar never exceeds 100%.
        const totalPepitasUteis = Object.values(sectionCounts).reduce(
            (acc, count) => acc + Math.min(count as number, 6), 0
        );
        const newProgress = Math.min((totalPepitasUteis / 24) * 100, 100);

        // add question options to already asked list
        // Combine the previously asked questions with the newly selected ones
        const newAskedQuestions = [...previouslyAsked, ...selectedQuestions];

        // Update firebase with new numbers
        const sessionRef = doc(getDb(), `users/${userId}/dnaSessions/${sessionId}`);
        await updateDoc(sessionRef, { 
          lastActiveAt: serverTimestamp(),
          totalExtractions: totalCount,
          sectionHqCounts: sectionCounts,
          progress: newProgress,           
          auditionsUnlocked: unlockedAuditions,
          askedQuestions: newAskedQuestions
        });
        

      } catch (error) {
        console.error("ERRO DETECTADO:", error);
        console.error("caiu no catch");
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

  // Sincroniza a mudança de aba com o Firebase
  const changeSection = useCallback(async (newSection: string) => {
    if (!firebaseAvailable || !session) return;
    
    const sessionRef = doc(getDb(), `users/${userId}/dnaSessions/${sessionId}`);
    await updateDoc(sessionRef, { 
      currentSection: newSection,
      lastActiveAt: serverTimestamp()
    });

    //inject intro messages
    const messagesRef = collection(getDb(), `users/${userId}/dnaSessions/${sessionId}/messages`);
    const q = query(messagesRef, where("section", "==", newSection), limit(1));
    const snapshot = await getDocs(q);

    // 3. Se a aba estiver vazia, injeta a mensagem do nosso Dicionário!
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

    console.log("New section: ", newSection);
  }, [userId, sessionId, session, firebaseAvailable]);

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