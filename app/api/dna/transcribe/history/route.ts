import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase.admin';
import { FieldValue } from 'firebase-admin/firestore';

interface TranscriptionRequest {
  audioBase64: string;
  mimeType?: string;
}

interface Milestone {
  event: string;
  emotional_cost: string;
  discoveredAt?: string;
}

interface AIExtractions {
  is_valuable_extraction?: boolean;
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
  progress_assessment: {
    has_actionable_pattern: boolean;
    depth_score: number;
  };
}

/**
 * Transcribes audio recordings and extracts psychological DNA data from spoken memories.
 * Saves both raw transcription and AI-extracted profile data to Firestore.
 * @param request - HTTP request with authorization token, base64-encoded audio, and mime type
 * @returns JSON response with transcribed text or error status
 * @async
 */
export async function POST(request: Request) {
  try {
    // auth
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token); 
    const userId = decodedToken.uid;

    // get audio
    const body = await request.json() as TranscriptionRequest;
    const { audioBase64, mimeType } = body;

    if (!audioBase64) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }

    // initializing AI
    const { getAI, getGenerativeModel, VertexAIBackend, SchemaType } = await import("firebase/ai");
    const { getApp: getFirebaseApp } = await import("@/lib/firebase");
    const ai = getAI(getFirebaseApp(), { backend: new VertexAIBackend() });
    
    // transcription
    const transcriptionModel = getGenerativeModel(ai, {
      model: "gemini-2.5-flash",
      generationConfig: { temperature: 0.1 }, 
    } );

    const audioPart = {
      inlineData: { data: audioBase64, mimeType: mimeType || "audio/webm" }
    };

    const transcriptionResult = await transcriptionModel.generateContent([
      "Transcribe this audio exactly as spoken. Return only the raw text.", 
      audioPart
    ]);
    const transcribedText = transcriptionResult.response.text().trim();

    if (transcribedText.length < 5) {
      return NextResponse.json({ error: 'Audio too short or silent' }, { status: 400 });
    }

    // extraction model
    const extractionModel = getGenerativeModel(ai, {
            model: "gemini-2.5-pro",
            generationConfig: { temperature: 0.1 }, 
            // @ts-expect-error
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
        } ); 

    const extractionPrompt = `
      You are an elite Psychological Profiler. The actor just recorded a raw, spoken memory.
      Read the transcription and extract maximum psychological value. Read between the lines.
      
      [ACTOR'S SPOKEN MEMORY]
      "${transcribedText}"
    `;

    const extractionResult = await extractionModel.generateContent(extractionPrompt);
    
    let aiExtractions: AIExtractions | null = null;
    const functionCalls = extractionResult.response.functionCalls(); 

    if (functionCalls && functionCalls?.length > 0) {
        // Forçamos o tipo após a validação da chamada de função
        aiExtractions = functionCalls[0].args as unknown as AIExtractions;
    }
    

    //saving
    const userRecord = await auth.getUser(userId);
    const firstName = userRecord.displayName?.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") || "Actor";
    const userPath = `${userId}_${firstName}`;

    const profileRef = db.doc(`users/${userPath}/profile/master`);
    
    // save plain transcription
    const updatePayload: Record<string, unknown> = {
      lastUpdated: FieldValue.serverTimestamp(),
      rawMemories: FieldValue.arrayUnion({
        text: transcribedText,
        timestamp: new Date().toISOString()
      })
    };

    if (aiExtractions) {
      if (aiExtractions.new_traits && aiExtractions.new_traits?.length > 0) updatePayload['psychology.traits'] = FieldValue.arrayUnion(...aiExtractions.new_traits);
        if (aiExtractions.defense_mechanisms && aiExtractions.defense_mechanisms?.length > 0) updatePayload['psychology.defenseMechanisms'] = FieldValue.arrayUnion(...aiExtractions.defense_mechanisms);
        if (aiExtractions.leaf_snippets && aiExtractions.leaf_snippets?.length > 0) {
            const snippetsWithContext = aiExtractions.leaf_snippets.map((quote: string) => ({ quote, timestamp: new Date().toISOString() }));
            updatePayload['psychology.leafSnippets'] = FieldValue.arrayUnion(...snippetsWithContext);
        }
        if (aiExtractions.holistic_analysis) updatePayload['psychology.analysisTimeline'] = FieldValue.arrayUnion({ inference: aiExtractions.holistic_analysis, timestamp: new Date().toISOString() });
        if (aiExtractions.somatic_tells && aiExtractions.somatic_tells?.length > 0) updatePayload['physicality.somaticTells'] = FieldValue.arrayUnion(...aiExtractions.somatic_tells);
        if (aiExtractions.core_values && aiExtractions.core_values?.length > 0) updatePayload['psychology.coreValues'] = FieldValue.arrayUnion(...aiExtractions.core_values);
        if (aiExtractions.relational_dynamics && aiExtractions.relational_dynamics?.length > 0) updatePayload['psychology.relationalDynamics'] = FieldValue.arrayUnion(...aiExtractions.relational_dynamics);
        if (aiExtractions.milestones && aiExtractions.milestones?.length > 0) {
            const milestonesWithContext = aiExtractions.milestones.map((milestone: any) => ({ ...milestone, discoveredAt: new Date().toISOString() }));
            updatePayload['history.milestones'] = FieldValue.arrayUnion(...milestonesWithContext);
        }
        if (aiExtractions.core_wounds_and_fears && aiExtractions.core_wounds_and_fears?.length > 0) updatePayload['acting_fuel.coreWounds'] = FieldValue.arrayUnion(...aiExtractions.core_wounds_and_fears);
        if (aiExtractions.unmet_needs && aiExtractions.unmet_needs?.length > 0) updatePayload['acting_fuel.unmetNeeds'] = FieldValue.arrayUnion(...aiExtractions.unmet_needs);
        if (aiExtractions.public_masks && aiExtractions.public_masks?.length > 0) updatePayload['acting_fuel.publicMasks'] = FieldValue.arrayUnion(...aiExtractions.public_masks);

        if (aiExtractions.emotional_baseline) {
            if (aiExtractions.emotional_baseline.conflict_response) updatePayload['psychology.emotionalBaseline.conflictResponse'] = aiExtractions.emotional_baseline.conflict_response;
            if (aiExtractions.emotional_baseline.internal_friction) updatePayload['psychology.emotionalBaseline.internalFriction'] = aiExtractions.emotional_baseline.internal_friction;
            if (aiExtractions.emotional_baseline.vulnerability_management) updatePayload['psychology.emotionalBaseline.vulnerabilityManagement'] = aiExtractions.emotional_baseline.vulnerability_management;
        }
        if (aiExtractions.intellectual_framework) {
            if (aiExtractions.intellectual_framework.cognitive_style) updatePayload['psychology.intellectualFramework.cognitiveStyle'] = aiExtractions.intellectual_framework.cognitive_style;
            if (aiExtractions.intellectual_framework.attention_to_detail) updatePayload['psychology.intellectualFramework.attentionToDetail'] = aiExtractions.intellectual_framework.attention_to_detail;
        }

        if (aiExtractions.archetype_signals && aiExtractions.archetype_signals?.length > 0) updatePayload['acting_fuel.archetypes'] = FieldValue.arrayUnion(...aiExtractions.archetype_signals);
        if (aiExtractions.key_entities_and_arenas && aiExtractions.key_entities_and_arenas?.length > 0) updatePayload['history.keyEntities'] = FieldValue.arrayUnion(...aiExtractions.key_entities_and_arenas);
        
    }

    await profileRef.set(updatePayload, { merge: true });

    return NextResponse.json({ success: true, text: transcribedText }, { status: 200 });

  } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        console.error("Memory Processing Error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
}
}