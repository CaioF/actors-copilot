import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase.admin';
import { SECTION_PROMPTS, SYSTEM_PROMPT } from '@/lib/prompts';
import { QUESTIONS } from '@/lib/questions';
import { saveRawMessageToFirestore } from '@/lib/firestore.utils'; 

export async function POST(request: Request) {
    try {
        // 1. SEGURANÇA E AUTENTICAÇÃO
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(token); 
        const userId = decodedToken.uid;

        // 2. EXTRAÇÃO DOS DADOS DO FRONTEND
        const body = await request.json();
        const { content, currentSection, actorName, history, previouslyAsked } = body;

        // 3. INJEÇÃO DINÂMICA DE CONTEXTO
        const allSectionQuestions: string[] = QUESTIONS[currentSection] || [];
        const availableQuestions = allSectionQuestions.filter((q: string) => !(previouslyAsked || []).includes(q));
        
        const shuffledQuestions = [...availableQuestions].sort(() => 0.5 - Math.random());
        const selectedQuestions = shuffledQuestions.slice(0, 3);
        const questionsListText = selectedQuestions.map((q: string) => `- ${q}`).join("\n");

        // 3. DYNAMIC CONTEXT INJECTION
        const specificSectionDirective = SECTION_PROMPTS[currentSection] || SECTION_PROMPTS['identity'];

        const finalPromptForAI = `
            ${SYSTEM_PROMPT}

            ${specificSectionDirective}

            Actor's Name: ${actorName}
            Actor's Input: "${content.trim()}"
            
            Suggested Thematic Directions (Use these strictly as inspiration for your Socratic questioning, do not ask them verbatim):
            ${questionsListText}

        `;

        // 4. INICIALIZAÇÃO DA VERTEX AI (Agora importando SchemaType corretamente!)
        const { getAI, getGenerativeModel, VertexAIBackend, SchemaType } = await import("firebase/ai");
        const { getApp: getFirebaseApp } = await import("@/lib/firebase");

        const ai = getAI(getFirebaseApp(), { backend: new VertexAIBackend() });
        
        // --- AGENTE 1: YAN (Conversacional) ---
        const chatModel = getGenerativeModel(ai, { 
            model: "gemini-2.5-pro", 
            generationConfig: { temperature: 0.4 },
            thinkingConfig: {
                thinkingLevel: "HIGH" // Forces the model to use internal deliberation before answering
            }
        } as any); // Type assertion to bypass the current typing issue with getGenerativeModel);

        // --- AGENTE 2: MEMLISTENER (Extração) ---
        // --- AGENT 2: MEMLISTENER (Contextual Extraction) ---
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

        // 5. EXECUTANDO OS DOIS AGENTES EM PARALELO
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

        // 6. PROCESSANDO OS RESULTADOS
        const aiResponseText = chatResult.response.text();
        
        let extractionsData = null;
        
        // Correção crítica: functionCalls é um método, exige os parênteses ()
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

        // 8. RETORNANDO O FORMATO EXATO
        return NextResponse.json({
            aiData: {
                coach_reply: aiResponseText,
                extractions: extractionsData 
            },
            selectedQuestions 
        }, { status: 200 });

    } catch (error) {
        console.error("Secure Chat API Error:", error);
        return NextResponse.json({ error: 'Failed to generate chat response' }, { status: 500 });
    }
}