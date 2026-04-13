import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase.admin';
import { SECTION_PROMPTS, SYSTEM_PROMPT } from '@/lib/prompts';
import { QUESTIONS } from '@/lib/questions';
import { saveRawMessageToFirestore } from '@/lib/firestore.utils'; 

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
        
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(token); 
        const userId = decodedToken.uid;

        const body = await request.json();
        const { content, currentSection, actorName, history, previouslyAsked } = body;

        const specificSectionDirective = SECTION_PROMPTS[currentSection] || SECTION_PROMPTS['identity'];

        const recentQuestions = previouslyAsked ? previouslyAsked.slice(-4) : [];
        const blacklistText = recentQuestions.length > 0 
            ? recentQuestions.map((q: string, i: number) => `Prior AI Question: "${q}"`).join('\n') 
            : "No previous questions.";

        //PIVOT ENGINE 
        const questionCount = previouslyAsked?.length || 0;
        
        // const isFrustrated = /|don'?t remember|no|stop|uncomfortable|not relevant/i.test(content) || content.trim().length < 10;
        const isFrustrated = false;
        const isMandatoryPivot = questionCount > 0 && questionCount % 10 === 0;

        let dynamicCommand = "";
        if (isFrustrated) {
            dynamicCommand = `[SYSTEM OVERRIDE: HARD PIVOT REQUIRED - change the subject]
            The user's input indicates frustration, confusion, or a refusal to elaborate. 
            COMMAND: YOU MUST IMMEDIATELY DROP THE CURRENT MEMORY. 
            Select a COMPLETELY DIFFERENT "Follow-up Route" from your arsenal.`;
        } else if (isMandatoryPivot) {
            dynamicCommand = `[SYSTEM OVERRIDE: MANDATORY THEME SHIFT]
            You have spent enough time digging into this specific memory. To ensure a diverse range of data, PIVOT NOW. 
            COMMAND: Look at the "Follow-up Routes" above. Select a NEW route that you haven't explored yet. Ask a question from that new route to open a completely different angle.`;
        } else {
            dynamicCommand = `[MOMENTUM CHECK]
            Continue the Socratic extraction naturally. Ask ONE follow-up question. However, if you feel the current specific memory is fully explored, do not hesitate to pivot to a new Route.`;
        }

        const finalPromptForAI = `
        system instruction: ${SYSTEM_PROMPT}
            ${specificSectionDirective}

            === YOUR PREVIOUS RECENT QUESTIONS ===
            You are STRICTLY FORBIDDEN from repeating the essence of these questions. Do not ask them again:
            ${blacklistText}

            === CONVERSATION STATE ===
            Actor's Name: ${actorName}
            Actor's Latest Input: "${content.trim()}"
            
            === YOUR DIRECTIVE FOR THIS TURN ===
            ${dynamicCommand}
            Don't use the connective "understood".
            Don't repeat what they just said.
            
            `;
            console.log(dynamicCommand);

        const { getAI, getGenerativeModel, VertexAIBackend, SchemaType } = await import("firebase/ai");
        const { getApp: getFirebaseApp } = await import("@/lib/firebase");

        const ai = getAI(getFirebaseApp(), { backend: new VertexAIBackend() });
        
        // --- AGENT 1: YAN (Conversacional) ---
        const chatModel = getGenerativeModel(ai, { 
            model: "gemini-2.5-pro", 
            generationConfig: { temperature: 0.4 },
            thinkingConfig: {
                thinkingLevel: "HIGH" // Forces the model to use internal deliberation before answering
            }
        } as any); // Type assertion to bypass the current typing issue with getGenerativeModel);

        // --- AGENT 2: MEMLISTENER (Context Extraction) ---
        const extractionModel = getGenerativeModel(ai, {
            model: "gemini-2.5-pro",
            generationConfig: { temperature: 0.1 }, 
            thinkingConfig: { thinkingLevel: "HIGH" },
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
        } as any); 


        console.log(`Iniciando IA dupla para a seção: ${currentSection}...`);

        const chat = chatModel.startChat({
            systemInstruction: { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            history: history, 
        });

        // Build the history context for the extraction model to read
        const recentHistoryText = history.slice(-7).map((msg: any) => `${msg.role.toUpperCase()}: ${msg.parts[0].text}`).join('\n');

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

        const [chatResult, extractionResult] = await Promise.all([
            chat.sendMessage(finalPromptForAI),
            extractionModel.generateContent(promptForExtraction)
        ]);

        const aiResponseText = chatResult.response.text();
        
        let extractionsData = null;
        
        const functionCalls = extractionResult.response.functionCalls(); 
        
        if (functionCalls && functionCalls.length > 0) {
            extractionsData = functionCalls[0].args;
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
        console.error("Secure Chat API Error:", error);
        return NextResponse.json({ error: 'Failed to generate chat response' }, { status: 500 });
    }
}