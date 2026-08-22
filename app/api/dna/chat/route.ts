import { NextResponse, after } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { SECTION_PROMPTS, SYSTEM_PROMPT } from '@/lib/prompts';
import { createChildLogger } from '@/lib/logger';
import { logger } from '@/lib/logger';
import type { ChatHistoryMessage, ExtractedPsychData } from '@/lib/chat-types';
import { EXTRACTION_TOOL } from '@/lib/dna/extraction/extraction-tool-schema';
import { documentToPromptPart, validateDocumentPayload } from '@/lib/document-processing';

/**
 * Handles conversational DNA extraction chat, running dual AI models:
 * YAN (Socratic coach) is executed blocking for immediate user response, while
 * MEMLISTENER (psychological profiler) runs asynchronously in a background worker.
 * @param request - HTTP request with authorization token, chat content, current section,
 *                  actor name, conversation history, and previously asked questions
 * @returns JSON response with AI coach reply
 * @async
 */
export async function POST(request: Request) {
    const t0 = performance.now();
    console.log(`[PERF][SERVER] 🚀 POST /api/dna/chat request received at t=0ms`);
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log(`[PERF][SERVER] ❌ Unauthorized request (no bearer token) after ${(performance.now() - t0).toFixed(1)}ms`);
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { content, currentSection, actorName, history, previouslyAsked, pivotFlag, document } = body;

        if (document !== undefined) {
            const validation = validateDocumentPayload(document);
            if (!validation.ok) {
                console.log(`[PERF][SERVER] ❌ Invalid document payload after ${(performance.now() - t0).toFixed(1)}ms`);
                return NextResponse.json({ error: validation.error }, { status: validation.status });
            }
        }

        const specificSectionDirective = SECTION_PROMPTS[currentSection] || SECTION_PROMPTS['identity'];

        const recentQuestions = previouslyAsked ? previouslyAsked.slice(-6) : [];
        const blacklistText = recentQuestions.length > 0 
            ? recentQuestions.map((q: string, i: number) => `Prior AI Question: "${q}"`).join('\n') 
            : "No previous questions.";

        const tAuthStart = performance.now();
        const { auth, db, verifyOrDecodeIdToken } = await import('@/lib/firebase.admin');
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = typeof verifyOrDecodeIdToken === 'function'
            ? await verifyOrDecodeIdToken(token)
            : await auth.verifyIdToken(token);
        
        let rawFirstName = actorName || (decodedToken as { name?: string }).name?.split(" ")[0];
        if (!rawFirstName && auth.getUser) {
            try {
                const userRecord = await auth.getUser(decodedToken.uid);
                if (userRecord?.displayName) {
                    rawFirstName = userRecord.displayName.split(" ")[0];
                }
            } catch {
                // Fallback
            }
        }
        const firstName = (rawFirstName || "Actor").replace(/[^a-zA-Z0-9]/g, "") || "Actor";
        const userPath = `${decodedToken.uid}_${firstName}`;
        console.log(`[PERF][SERVER] ⏱️ Auth verification completed in ${(performance.now() - tAuthStart).toFixed(1)}ms (userPath: ${userPath})`);

        const log = createChildLogger({ route: 'dna/chat', userPath, currentSection });
        log.trace({ bodyKeys: Object.keys(body) }, 'Request body received');

        const tProfileStart = performance.now();
        const profileRef = db.doc(`users/${userPath}/profile/master`);
        const profileSnap = await profileRef.get();
        console.log(`[PERF][SERVER] ⏱️ Master profile read completed in ${(performance.now() - tProfileStart).toFixed(1)}ms`);
        
        let baselineContext = "";
        if (profileSnap.exists) {
            const summary = profileSnap.data()?.baselineSummary;
            if (summary) {
                baselineContext = `\n\n# ACTOR'S KNOWN BASELINE STORY:\n${summary}\n(Use this background knowledge to inform your Socratic questioning, but do not recite it back to them unless it's in order to show a contradiction.)`;
            }
        }

        //PIVOT ENGINE
        const questionCount = previouslyAsked?.length || 0;
        const isShort = content.trim().length < 15;
        const isMandatoryPivot = false;

        const hasDocumentAttached = document && document.data ? true : false;
        const isEndSession = content.includes("Please help me ground myself and close the session.");

        const skipPhrases = [
            "Pass", 
            "Change the subject, next question", 
        ];
        const isSkipCommand = skipPhrases.includes(content.trim());
        const isResumeSessionContinue = content.includes("Pick up where I left off");
        const isResumeSessionNew = content.includes("Start something new");
        const isFirstIdentityResponse = currentSection === 'identity' && (!previouslyAsked || previouslyAsked.length === 0);

        let dynamicCommand = "";
        if (isEndSession) {
            dynamicCommand = `[SYSTEM OVERRIDE: INITIATE GROUNDING PROTOCOL]
            The user has explicitly requested to end the current extraction session safely.
            
            IMMEDIATE CRITICAL DIRECTIVES:
            1. CEASE ALL EXTRACTION: Stop all Socratic questioning, probing, and psychological digging immediately. Do NOT ask any further questions about their memories or traits.
            2. VALIDATION: Acknowledge the emotional work they have done today and validate their effort in exploring these depths.
            3. GROUNDING EXERCISE: Guide the user through a brief, calming grounding technique to help them detach from the character/memory and return to their baseline reality. Provide a simple sensory exercise (e.g., the 5-4-3-2-1 technique or a guided deep breath).
            4. CLOSURE: End with a warm, supportive closing statement indicating that the session is now complete and they are safe to step away from the screen. Keep the tone empathetic, grounded, and professional.`;
        } else if (isShort && !pivotFlag) {
            dynamicCommand = `[User is giving very short input]
            Instigate deeper. The user's latest message is very brief, which may indicate they are holding back or struggling to articulate.
            Ask a follow-up question that encourages them to expand and provide more detail. Do not accept one-word answers. Push for depth and specificity. Explain your reasoning to the user to encourage them to open up.
            `;
        } else if (isSkipCommand) {
            dynamicCommand = `[SYSTEM OVERRIDE: USER SKIPPED QUESTION]
            The user has explicitly chosen to skip the previous question or requested a change of subject.
            CRITICAL DIRECTIVES:
            1. Do NOT ask why they skipped. Do NOT probe into their refusal.
            2. Pivot immediately to a completely NEW Route from the instructions. 
            3. Ask a fresh, unrelated Socratic question to regain momentum.`;
        } else if (isMandatoryPivot) {
            dynamicCommand = `[SYSTEM OVERRIDE: MANDATORY THEME SHIFT]
            You have spent enough time digging into this specific memory. To ensure a diverse range of data, PIVOT NOW.
            COMMAND: Look at the "Follow-up Routes" above. Select a NEW route that you haven't explored yet. Ask a question from that new route to open a completely different angle.`;
        } else if (pivotFlag === true) {
            dynamicCommand = `[THEME EXHAUSTION DETECTED]
            Our monitoring has detected potential theme exhaustion in this conversation path.
            Review the recent exchange carefully: if the last several exchanges show diminishing thematic diversity or repetitive patterns, the current conversation path may not be bearing fruit.
            Deeply consider pivoting to a new Route that explores a different psychological dimension, rather than continuing to dig deeper into the same thematic territory.`;
        } else if (isResumeSessionContinue) {
            dynamicCommand = `[SYSTEM OVERRIDE: WELCOME BACK & CONTINUE]
            The user has returned to the session after taking a break and wants to continue their previous train of thought.
            
            CRITICAL DIRECTIVES:
            1. WARM WELCOME: Start with a brief, grounding, and gentle welcome back message to make them feel safe.
            2. CONTEXTUALIZE: Review the conversation history prior to the break.
            3. RESUME SONDAGE: Ask ONE follow-up Socratic question that picks up exactly where the previous deep conversation left off. Maintain the momentum of the prior topic.`;
        } else if (isResumeSessionNew) {
            dynamicCommand = `[SYSTEM OVERRIDE: WELCOME BACK & PIVOT]
            The user has returned to the session after taking a break and specifically requested to start fresh.
            
            CRITICAL DIRECTIVES:
            1. WARM WELCOME: Start with a brief, grounding, and gentle welcome back message to make them feel safe.
            2. DROP THE PAST: Completely abandon whatever specific memory or theme was being discussed before the break. Do not reference it.
            3. FRESH START: Look at your provided "Follow-up Routes" in the system instructions. Pick a completely NEW, unexplored route and ask a fresh Socratic question to open a new angle of psychological exploration.`;
        } else if (isFirstIdentityResponse) {
            dynamicCommand = `[SYSTEM OVERRIDE: BASELINE GATEKEEPER]
            The user is currently responding to your initial 3-part baseline question: 1. Age, 2. Location, 3. Elevator pitch.
            
            CRITICAL DIRECTIVES:
            1. Analyze their input. Did they explicitly provide ALL THREE pieces of information?
            2. MISSING INFO: If they missed any of the three, your ONLY task this turn is to warmly acknowledge what they did share, and directly ask them to fill in the missing piece(s) before moving forward. (e.g., "I love that pitch, but you forgot to tell me your age and where you're based!")
            3. ALL GOOD: If they successfully answered all three, proceed normally. Choose a "Follow-up Route" to start challenging the mask they presented in their elevator pitch.`;
        } else {
            dynamicCommand = `[MOMENTUM CHECK]
            Continue the Socratic extraction naturally. Ask ONE follow-up question. However, if you feel the current specific memory is fully explored, do not hesitate to pivot to a new Route.`;
        }

        const finalPromptForAI = `
        system instruction:
            ${specificSectionDirective}

            ${baselineContext}

            === YOUR PREVIOUS RECENT QUESTIONS ===
            You are STRICTLY FORBIDDEN from repeating the essence of these questions. Do not ask them again:
            ${blacklistText}

            === CONVERSATION STATE ===
            User's Name: ${actorName}
            User's Latest Input:  "${content.trim()}"
            DO NOT REPEAT THE USER'S WORDS BACK TO THEM. Do not paraphrase or summarize their input.
            
            === YOUR DIRECTIVE FOR THIS TURN ===
            ${dynamicCommand}

            ${hasDocumentAttached ? `
            The user has attached a document alongside their message. You MUST read the contents of this document (provided either as inline binary data or extracted text below).
            Explicitly acknowledge that you have received and read the file, and deeply integrate its contents into your next Socratic response.
            ` : ""}
            
            `;

        const tModelInitStart = performance.now();
        const { getAI, getGenerativeModel, VertexAIBackend } = await import("firebase/ai");
        const { getApp: getFirebaseApp } = await import("@/lib/firebase");

        const aiGlobal = getAI(getFirebaseApp(), { 
            backend: new VertexAIBackend('global') 
        });
        
        const aiCentral = getAI(getFirebaseApp(), { 
            backend: new VertexAIBackend() 
        });
        
        // --- AGENT 1: YAN (Conversational) ---
        const chatModel = getGenerativeModel(aiGlobal, { 
            model: "gemini-3.1-pro-preview", 
        }); 

        // --- AGENT 2: MEMLISTENER (Context Extraction) ---
        const extractionModel = getGenerativeModel(aiCentral, {
            model: "gemini-2.5-pro",
            generationConfig: { temperature: 0.1 }, 
            tools: [EXTRACTION_TOOL],
        }); 

        // Cap YAN history to the recent 15 messages for optimal token throughput
        const historyForYan = history.slice(-15);

        const chat = chatModel.startChat({
            systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
            history: historyForYan, 
        });

        const recentHistoryText = history.slice(-7).map((msg: ChatHistoryMessage) => `${msg.role.toUpperCase()}: ${msg.parts[0].text}`).join('\n');

        const promptForExtraction = `
            [SYSTEM INSTRUCTION FOR EXTRACTION]
            You are a silent psychological profiler. Analyze the conversation history and the actor's latest input.
            Task: Extract ONLY NEW, actionable psychological data, their core identity and defense mechanisms, and provide a holistic analysis. Do NOT extract if the actor is being repetitive, superficial, or making small talk. Your goal is to identify deep, novel insights into their soul and heart. 
            If the actor is making small talk, repeating previous points, or being superficial, set 'has_actionable_pattern' to false and leave the data arrays empty.
            Look at the broader context of the history to make holistic inferences.

            [CONVERSATION HISTORY]
            ${recentHistoryText}

            [LATEST ACTOR INPUT]
            "${content.trim()}"
        `;

        type PromptPart = { text: string } | { inlineData: { data: string; mimeType: string } };

        const promptParts: PromptPart[] = [
            { text: finalPromptForAI }
        ];

        if (document && document.data && document.mimeType) {
            const docPart = await documentToPromptPart(document);
            if (!docPart.ok) {
                console.log(`[PERF][SERVER] ❌ Document processing failed after ${(performance.now() - t0).toFixed(1)}ms`);
                log.error({ mimeType: document.mimeType }, 'Document processing failed');
                return NextResponse.json({ error: docPart.error }, { status: docPart.status });
            }
            promptParts.push(docPart.part);
        }

        console.log(`[PERF][SERVER] ⏱️ AI Models & Prompt prepared in ${(performance.now() - tModelInitStart).toFixed(1)}ms. Invoking YAN chat.sendMessage(promptParts)...`);

        // 1. FAST BLOCKING PATH: Generate YAN response immediately (1.5-2.5s)
        const tYanStart = performance.now();
        const chatResult = await chat.sendMessage(promptParts);
        const aiResponseText = chatResult.response.text();
        console.log(`[PERF][SERVER] ⏱️ YAN chat.sendMessage completed in ${(performance.now() - tYanStart).toFixed(1)}ms (Output length: ${aiResponseText.length} chars)`);

        // 2. ASYNC BACKGROUND EXTRACTION WORKER: MEMLISTENER runs non-blocking
        const shouldExtract = !isEndSession && !isSkipCommand && !isResumeSessionContinue && !isResumeSessionNew;

        if (shouldExtract) {
            const backgroundTask = async () => {
                const tBgStart = performance.now();
                console.log(`[PERF][SERVER][BG] ⏱️ Starting MEMLISTENER background extraction...`);
                try {
                    const extractionResult = await extractionModel.generateContent(promptForExtraction);
                    const functionCalls = extractionResult.response.functionCalls();
                    if (functionCalls && functionCalls.length > 0) {
                        const extractionsData = functionCalls[0].args as unknown as ExtractedPsychData;
                        const aiAssessment = extractionsData.progress_assessment;
                        const isHighQuality =
                            aiAssessment != null &&
                            aiAssessment.has_actionable_pattern === true &&
                            (aiAssessment.depth_score ?? 0) >= 4;

                        if (isHighQuality) {
                            const updatePayload: Record<string, unknown> = { lastUpdated: FieldValue.serverTimestamp() };
                            if (extractionsData.new_traits?.length) updatePayload['psychology.traits'] = FieldValue.arrayUnion(...extractionsData.new_traits);
                            if (extractionsData.defense_mechanisms?.length) updatePayload['psychology.defenseMechanisms'] = FieldValue.arrayUnion(...extractionsData.defense_mechanisms);
                            if (extractionsData.leaf_snippets?.length) {
                                const snippetsWithContext = extractionsData.leaf_snippets.map((quote: string) => ({ quote, section: currentSection, timestamp: new Date().toISOString() }));
                                updatePayload['psychology.leafSnippets'] = FieldValue.arrayUnion(...snippetsWithContext);
                            }
                            if (extractionsData.holistic_analysis) updatePayload['psychology.analysisTimeline'] = FieldValue.arrayUnion({ inference: extractionsData.holistic_analysis, section: currentSection, timestamp: new Date().toISOString() });
                            if (extractionsData.somatic_tells?.length) updatePayload['physicality.somaticTells'] = FieldValue.arrayUnion(...extractionsData.somatic_tells);
                            if (extractionsData.core_values?.length) updatePayload['psychology.coreValues'] = FieldValue.arrayUnion(...extractionsData.core_values);
                            if (extractionsData.relational_dynamics?.length) updatePayload['psychology.relationalDynamics'] = FieldValue.arrayUnion(...extractionsData.relational_dynamics);
                            if (extractionsData.milestones?.length) {
                                const milestonesWithContext = extractionsData.milestones.map((m: any) => ({ ...m, section: currentSection, discoveredAt: new Date().toISOString() }));
                                updatePayload['history.milestones'] = FieldValue.arrayUnion(...milestonesWithContext);
                            }
                            if (extractionsData.core_wounds_and_fears?.length) updatePayload['acting_fuel.coreWounds'] = FieldValue.arrayUnion(...extractionsData.core_wounds_and_fears);
                            if (extractionsData.unmet_needs?.length) updatePayload['acting_fuel.unmetNeeds'] = FieldValue.arrayUnion(...extractionsData.unmet_needs);
                            if (extractionsData.public_masks?.length) updatePayload['acting_fuel.publicMasks'] = FieldValue.arrayUnion(...extractionsData.public_masks);
                            if (extractionsData.archetype_signals?.length) updatePayload['acting_fuel.archetypes'] = FieldValue.arrayUnion(...extractionsData.archetype_signals);
                            if (extractionsData.key_entities_and_arenas?.length) updatePayload['history.keyEntities'] = FieldValue.arrayUnion(...extractionsData.key_entities_and_arenas);

                            await profileRef.set(updatePayload, { merge: true });
                            console.log(`[PERF][SERVER][BG] ✅ MEMLISTENER extraction saved to profile/master in ${(performance.now() - tBgStart).toFixed(1)}ms`);
                        } else {
                            console.log(`[PERF][SERVER][BG] ℹ️ MEMLISTENER extraction completed in ${(performance.now() - tBgStart).toFixed(1)}ms (low quality score, skipped profile update)`);
                        }
                    }
                } catch (err) {
                    console.error(`[PERF][SERVER][BG] ❌ MEMLISTENER extraction failed gracefully in ${(performance.now() - tBgStart).toFixed(1)}ms:`, err);
                }
            };

            if (typeof after === 'function') {
                after(backgroundTask);
            } else {
                void backgroundTask();
            }
        }

        console.log(`[PERF][SERVER] 🏁 Returning HTTP 200 JSON to client at t=${(performance.now() - t0).toFixed(1)}ms`);

        return NextResponse.json({
            aiData: {
                coach_reply: aiResponseText,
                extractions: null 
            },
            selectedQuestions: [aiResponseText] 
        }, { status: 200 });

    } catch (error) {
        console.error(`[PERF][SERVER] ❌ Fatal API Error after ${(performance.now() - t0).toFixed(1)}ms:`, error);
        logger.error({ err: error, msg: 'Secure Chat API Error' });
        return NextResponse.json({ error: 'Failed to generate chat response' }, { status: 500 });
    }
}