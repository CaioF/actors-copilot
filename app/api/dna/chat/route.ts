import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase.admin';
import { SYSTEM_PROMPT } from '@/lib/prompts';
import { QUESTIONS } from '@/lib/questions';

/**
 * Secure Backend Endpoint for DNA Extraction Chat.
 * Handles AI prompt construction and model inference to protect intellectual property.
 */
export async function POST(request: Request) {
    try {
        // 1. SECURITY & AUTHENTICATION (Token Verification)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Extract token and verify using Firebase Admin
        const token = authHeader.split('Bearer ')[1];
        await auth.verifyIdToken(token); 

        // 2. EXTRACT INCOMING DATA FROM CLIENT
        const body = await request.json();
        const { content, currentSection, actorName, history, previouslyAsked } = body;

        // 3. DYNAMIC QUESTION SELECTION (Hidden from Client)
        const allSectionQuestions: string[] = QUESTIONS[currentSection] || [];
        const availableQuestions = allSectionQuestions.filter((q: string) => !(previouslyAsked || []).includes(q));
        
        // Shuffle and select up to 3 questions
        const shuffledQuestions = [...availableQuestions].sort(() => 0.5 - Math.random());
        const selectedQuestions = shuffledQuestions.slice(0, 3);
        const questionsListText = selectedQuestions.map((q: string) => `- ${q}`).join("\n");

        // Compile the dynamic prompt injected with the hidden context
        const finalPromptForAI = `[CURRENT EXPLORATION ARENA: ${currentSection.toUpperCase()}]\nKeep your tone and extractions strictly focused on this arena.You are speaking directly to the actor, their name is ${actorName} . \n\nActor's Input: "${content.trim()}"\n\nSuggested Thematic Directions (Use these as inspiration...):\n${questionsListText}`;

        // 4. INITIALIZE VERTEX AI FOR FIREBASE (Using your custom backend adapter pattern)
        const { getAI, getGenerativeModel, VertexAIBackend } = await import("firebase/ai");
        const { getApp: getFirebaseApp } = await import("@/lib/firebase");

        const ai = getAI(getFirebaseApp(), { backend: new VertexAIBackend() });
        const model = getGenerativeModel(ai, { 
            model: "gemini-2.0-flash",
            // Enforce JSON structured output for programmatic parsing
            generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.3
            }
        });

        // 5. INJECT HISTORY AND SYSTEM PROMPT
        const chat = model.startChat({
            systemInstruction: { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            history: history, // Clean array passed from the client payload
        });

        console.log(`Initiating Vertex AI Chat Inference for section: ${currentSection}...`);

        // 6. EXECUTE AI INFERENCE AND PARSE RESPONSE
        const result = await chat.sendMessage(finalPromptForAI);
        const fullResponse = result.response.text();
        
        let aiData;
        try {
            aiData = JSON.parse(fullResponse);
            console.log("✅ CHAT RESPONSE GENERATED SUCCESSFULLY!");
        } catch (parseError) {
            console.error("Failed to parse AI JSON output:", fullResponse);
            // Safe fallback to prevent app crashes if the model hallucinates formatting
            aiData = { 
                coach_reply: "I encountered an issue generating a response. Let us continue — tell me more about what you were describing.", 
                extractions: null 
            };
        }

        // 7. RETURN TO FRONTEND
        return NextResponse.json({
            aiData,
            selectedQuestions 
        }, { status: 200 });

    } catch (error) {
        console.error("Secure Chat API Error:", error);
        return NextResponse.json({ error: 'Failed to generate chat response' }, { status: 500 });
    }
}