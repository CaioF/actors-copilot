import { NextResponse } from 'next/server';
import { SECTION_PROMPTS, SYSTEM_PROMPT } from '@/lib/prompts';
import { createChildLogger } from '@/lib/logger';
import { logger } from '@/lib/logger';

interface ChatHistoryMessage {
  role: string;
  parts: { text: string }[];
}

interface ExtractionMilestone {
    event: string;
    emotional_cost: string;
}

interface ExtractedPsychData {
    is_valuable_extraction?: boolean;
    new_traits?: string[];
    themes_extracted?: string[];
    defense_mechanisms?: string[];
    leaf_snippets?: string[];
    holistic_analysis?: string;
    somatic_tells?: string[];
    core_values?: string[];
    relational_dynamics?: string[];
    milestones?: ExtractionMilestone[];
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
    progress_assessment?: {
        has_actionable_pattern: boolean;
        depth_score: number;
    };
}

/**
 * Handles conversational DNA extraction chat, running dual AI models: one for Socratic
 * questioning and another for silent psychological data extraction from user responses.
 * @param request - HTTP request with authorization token, chat content, current section,
 *                  actor name, conversation history, and previously asked questions
 * @returns JSON response with AI coach reply and extracted psychological data
 * @async
 */
export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { content, currentSection, actorName, history, previouslyAsked, pivotFlag, document } = body;

        const specificSectionDirective = SECTION_PROMPTS[currentSection] || SECTION_PROMPTS['identity'];

        const recentQuestions = previouslyAsked ? previouslyAsked.slice(-6) : [];
        const blacklistText = recentQuestions.length > 0 
            ? recentQuestions.map((q: string, i: number) => `Prior AI Question: "${q}"`).join('\n') 
            : "No previous questions.";

        const { auth, db } = await import('@/lib/firebase.admin');
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(token);
        
        const userRecord = await auth.getUser(decodedToken.uid);
        const firstName = userRecord.displayName?.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") || "Actor";
        const userPath = `${decodedToken.uid}_${firstName}`;

        const log = createChildLogger({ route: 'dna/chat', userPath, currentSection });
        log.trace({ bodyKeys: Object.keys(body) }, 'Request body received');

        const profileRef = db.doc(`users/${userPath}/profile/master`);
        const profileSnap = await profileRef.get();
        
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
        // const isMandatoryPivot = questionCount > 0 && questionCount % 15 === 0;
        const isMandatoryPivot = false;

        log.trace({
            questionCount,
            isShort,
            isMandatoryPivot,
            pivotFlag: pivotFlag === true,
            contentLength: content.trim().length
        }, 'Pivot decision variables');

        /**
         * Flag to determine if a document payload is present in this exact turn.
         */
        const hasDocumentAttached = document && document.data ? true : false;

        /**
         * System flag to determine if the user has requested a safe session termination.
         * We parse the incoming message for the specific command tag dispatched by the UI.
         */
        const isEndSession = content.includes("Please help me ground myself and close the session.");

        /**
         * System flag to detect if the actor is utilizing a UI shortcut to bypass 
         * the current prompt. Used to prevent unnecessary extraction model execution.
         */
        const skipPhrases = [
            "Pass", 
            "Change the subject, next question", 
        ];
        const isSkipCommand = skipPhrases.includes(content.trim());

        let dynamicCommand = "";
        if (isEndSession) {
            dynamicCommand = `[SYSTEM OVERRIDE: INITIATE GROUNDING PROTOCOL]
            The user has explicitly requested to end the current extraction session safely.
            
            IMMEDIATE CRITICAL DIRECTIVES:
            1. CEASE ALL EXTRACTION: Stop all Socratic questioning, probing, and psychological digging immediately. Do NOT ask any further questions about their memories or traits.
            2. VALIDATION: Acknowledge the emotional work they have done today and validate their effort in exploring these depths.
            3. GROUNDING EXERCISE: Guide the user through a brief, calming grounding technique to help them detach from the character/memory and return to their baseline reality. Provide a simple sensory exercise (e.g., the 5-4-3-2-1 technique or a guided deep breath).
            4. CLOSURE: End with a warm, supportive closing statement indicating that the session is now complete and they are safe to step away from the screen. Keep the tone empathetic, grounded, and professional.`;
        } else
        if (isShort && !pivotFlag) {
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
            The user has attached a document alongside their message. You MUST read the contents of this document (provided as inlineData). 
            Explicitly acknowledge that you have received and read the file, and deeply integrate its contents into your next Socratic response.
            ` : ""}
            
            `;

        const { getAI, getGenerativeModel, VertexAIBackend, SchemaType } = await import("firebase/ai");
        const { getApp: getFirebaseApp } = await import("@/lib/firebase");

        const aiGlobal = getAI(getFirebaseApp(), { 
            backend: new VertexAIBackend('global') 
        });
        
        // Mantemos o padrão (us-central1) para o modelo de extração não quebrar
        const aiCentral = getAI(getFirebaseApp(), { 
            backend: new VertexAIBackend() 
        });
        
        // --- AGENT 1: YAN (Conversacional) ---
        const chatModel = getGenerativeModel(aiGlobal, { 
            model: "gemini-3.1-pro-preview", 
            
        } ); 

        // --- AGENT 2: MEMLISTENER (Context Extraction) ---
        const extractionModel = getGenerativeModel(aiCentral, {
            model: "gemini-2.5-pro",
            generationConfig: { temperature: 0.1 }, 
            // // @ts-expect-error
            // thinkingConfig: { thinkingLevel: "MEDIUM" },
            tools: [{
                functionDeclarations: [{
                    name: "update_master_profile",
                    description: "Analyzes the conversation history and the latest user input to extract NEW psychological data. DO NOT extract if the user is repeating themselves, making small talk, or providing superficial answers.",
                    parameters: {
                        type: SchemaType.OBJECT, 
                        properties: {
                            is_valuable_extraction: { 
                                type: SchemaType.BOOLEAN, 
                                description: "TRUE if the user provided new, deep, and actionable psychological insights. FALSE if it is small talk, repetitive, or superficial." 
                            },
                            new_traits: { 
                                type: SchemaType.ARRAY, 
                                description: "A list of NEW psychological traits, fears, or core needs discovered in this specific turn.",
                                items: { type: SchemaType.STRING }
                            },
                            defense_mechanisms: { 
                                type: SchemaType.ARRAY, 
                                description: "Any NEW behavioral defense mechanisms observed (e.g., 'uses humor to deflect', 'intellectualizes emotions').",
                                items: { type: SchemaType.STRING }
                            },
                            leaf_snippets: { 
                                type: SchemaType.ARRAY, 
                                description: "Exact, verbatim quotes from the actor's latest message that justify these new insights. Only include highly impactful quotes.",
                                items: { type: SchemaType.STRING }
                            },
                            holistic_analysis: {
                                type: SchemaType.STRING,
                                description: "A brief psychological inference drawing connections between the current message and the broader conversation history. What is the subtext?"
                            },
                            somatic_tells: {
                                type: SchemaType.ARRAY,
                                description: "Involuntary physical or physiological reactions the actor mentions (e.g., 'jaw tension', 'shallow breathing', 'avoiding eye contact', 'throat closing'). Crucial for acting.",
                                items: { type: SchemaType.STRING }
                            },
                            core_values: {
                                type: SchemaType.ARRAY,
                                description: "Fundamental beliefs, ethics, or moral baselines the user operates from (e.g., 'radical honesty', 'loyalty above all').",
                                items: { type: SchemaType.STRING }
                            },
                            relational_dynamics: {
                                type: SchemaType.ARRAY,
                                description: "How the user relates to others, particularly regarding power, submission, intimacy, or attachment (e.g., 'needs to be the caretaker', 'rebels against authority').",
                                items: { type: SchemaType.STRING }
                            },
                            milestones: {
                                type: SchemaType.ARRAY,
                                description: "Significant life events, traumas, or 'big wins' shared in this turn. Summarize the event and its emotional cost.",
                                items: { 
                                    type: SchemaType.OBJECT,
                                    properties: {
                                        event: { type: SchemaType.STRING, description: "The specific memory or event." },
                                        emotional_cost: { type: SchemaType.STRING, description: "The hidden toll or psychological impact it had on them." }
                                    }
                                }
                            },
                            // --- THE CORE ACTING FUEL ---
                            core_wounds_and_fears: {
                                type: SchemaType.ARRAY,
                                description: "Deep psychological scars or fundamental fears driving the user (e.g., 'fear of abandonment', 'terror of being average', 'childhood rejection').",
                                items: { type: SchemaType.STRING }
                            },
                            unmet_needs: {
                                type: SchemaType.ARRAY,
                                description: "The underlying desires or objectives the user is subconsciously chasing (e.g., 'desperate need for parental validation', 'need to be the smartest in the room').",
                                items: { type: SchemaType.STRING }
                            },
                            public_masks: {
                                type: SchemaType.ARRAY,
                                description: "The social personas or behavioral shields the user wears to hide their wounds (e.g., 'the untouchable stoic', 'the people-pleasing joker', 'the aggressive overachiever').",
                                items: { type: SchemaType.STRING }
                            },
                            // --- ADVANCED PSYCHOLOGICAL PROFILING ---
                            emotional_baseline: {
                                type: SchemaType.OBJECT,
                                description: "The actor's emotional operating system.",
                                properties: {
                                    conflict_response: { type: SchemaType.STRING, description: "How they navigate conflict (e.g., 'righteous anger', 'resolute patience', 'withdrawal')." },
                                    internal_friction: { type: SchemaType.STRING, description: "Suppressed emotions or recurring frustrations (e.g., 'feeling constantly misunderstood', 'boiling resentment')." },
                                    vulnerability_management: { type: SchemaType.STRING, description: "How they handle intimacy or exposure (e.g., 'deflects with humor', 'intellectualizes')." }
                                }
                            },
                            intellectual_framework: {
                                type: SchemaType.OBJECT,
                                description: "How the actor's brain processes information and narrative.",
                                properties: {
                                    cognitive_style: { type: SchemaType.STRING, description: "How they process tasks (e.g., 'structural/logical', 'chaotic/instinctive')." },
                                    attention_to_detail: { type: SchemaType.STRING, description: "Their pacing and focus (e.g., 'hyper-perfectionist', 'big-picture thinker')." }
                                }
                            },
                            archetype_signals: {
                                type: SchemaType.ARRAY,
                                description: "Inferred archetypal patterns. These are whispers, not headlines (e.g., 'The Protector', 'The Martyr', 'The Rebel').",
                                items: { type: SchemaType.STRING }
                            },
                            key_entities_and_arenas: {
                                type: SchemaType.ARRAY,
                                description: "Important people, places, or specific subcultures mentioned in the actor's stories (e.g., 'mother', 'tech industry', 'high school theatre').",
                                items: { type: SchemaType.STRING }
                            },


                            progress_assessment: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    has_actionable_pattern: { type: SchemaType.BOOLEAN, description: "True ONLY if genuinely new, playable, and useful patterns were revealed. False if it's repetitive or shallow." },
                                    depth_score: { type: SchemaType.NUMBER, description: "Score from 0 to 10 evaluating the emotional depth and vulnerability of the latest answer." }
                                },
                                required: ["has_actionable_pattern", "depth_score"]
                            }
                        },
                        required: ["progress_assessment"]
                    }
                }]
            }]
        } ); 


        const chat = chatModel.startChat({
            systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
            history: history, 
        });

        // Build the history context for the extraction model to read
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

        // Primary execution: Always generate the conversational response.
        type PromptPart = { text: string } | { inlineData: { data: string; mimeType: string } };
        
        /**
         * Initialize the prompt array with the mandatory system directives and user input.
         */
        const promptParts: PromptPart[] = [
            { text: finalPromptForAI }
        ];

        /**
         * If a valid document payload was provided in the request, append it as 
         * inlineData. Vertex AI engine natively processes this alongside the text.
         */
        if (document && document.data && document.mimeType) {
            promptParts.push({
                inlineData: {
                    data: document.data,
                    mimeType: document.mimeType
                }
            });
        }

        const chatResult = await chat.sendMessage(promptParts);

        const aiResponseText = chatResult.response.text();
        
        let extractionsData: ExtractedPsychData | null = null;
        
       /**
         * Declare functionCalls in the outer scope so it can be accessed later by the debug logger. 
         * Strictly typed to match the Firebase Vertex AI SDK FunctionCall signature to comply with no-any rules.
         */
        let functionCalls: { name: string; args: object }[] | undefined = undefined;
        
        /**
         * Secondary execution: Context Extraction
         * We strictly bypass the extraction model if the user is ending the session
         * or skipping the question, thereby saving token usage and preventing 
         * superficial data pollution in the psychological profile.
         */
        if (!isEndSession && !isSkipCommand) {
            const extractionResult = await extractionModel.generateContent(promptForExtraction);
            
            // Assign to the outer variable instead of using 'const'
            functionCalls = extractionResult.response.functionCalls(); 
            
            if (functionCalls && functionCalls.length > 0) {
                extractionsData = functionCalls[0].args as unknown as ExtractedPsychData;
            }
        }

        if (process.env.MEMLISTENER_DEBUG === 'true') {
            log.trace({
                hasExtractionData: extractionsData !== null,
                functionCallCount: functionCalls?.length || 0,
                uniqueThemeCount: extractionsData?.themes_extracted?.length || 0,
                hasProgressAssessment: extractionsData?.progress_assessment != null,
            }, 'MemListener extraction summary');
        }

        // 7. FIRE-AND-FORGET LOGGING - TEMPORARIAMENTE DESABILITADO PARA DEBUG
        // saveRawMessageToFirestore(userId, {
        //     userMessage: content,
        //     aiResponse: aiResponseText,
        //     timestamp: new Date().toISOString(),
        //     section: currentSection
        // }).catch((err: Error) => console.error("Failed to append to chat log:", err));

        return NextResponse.json({
            aiData: {
                coach_reply: aiResponseText,
                extractions: extractionsData 
            },
            selectedQuestions: [aiResponseText] 
        }, { status: 200 });

    } catch (error) {
        logger.error({ err: error, msg: 'Secure Chat API Error' });
        return NextResponse.json({ error: 'Failed to generate chat response' }, { status: 500 });
    }
}