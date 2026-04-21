import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase.admin'; 
import { FieldValue, DocumentData } from 'firebase-admin/firestore';
import PDFParser from 'pdf2json';
import mammoth from 'mammoth';
import { logger } from '@/lib/logger';

interface Milestone {
  event: string;
  emotional_cost: string;
  section?: string;
  discoveredAt?: string;
}

interface EmotionalBaseline {
  conflict_response?: string;
  internal_friction?: string;
  vulnerability_management?: string;
}

interface ActorProfileExtraction {
  new_traits?: string[];
  defense_mechanisms?: string[];
  core_values?: string[];
  relational_dynamics?: string[];
  milestones?: Milestone[];
  core_wounds_and_fears?: string[];
  unmet_needs?: string[];
  public_masks?: string[];
  emotional_baseline?: EmotionalBaseline;
  baseline_summary?: string;
  archetype_signals?: string[];
  key_entities_and_arenas?: string[];
}

/**
 * Extracts text content from a PDF buffer using pdf2json with a 60-second timeout
 * to handle complex or malformed PDF files safely.
 * @param buffer - The PDF file content as a Node.js Buffer
 * @returns A promise resolving to the extracted text content
 * @async
 */
const extractTextFromPDF = (buffer: Buffer): Promise<string> => {
  const parsePromise = new Promise<string>((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);

    pdfParser.on("pdfParser_dataError", (errData:{ parserError: Error | string }) => {
      reject(errData.parserError);
    });

    pdfParser.on("pdfParser_dataReady", () => {
      const rawText = pdfParser.getRawTextContent();
      resolve(decodeURIComponent(rawText));
    });

    pdfParser.parseBuffer(buffer);
  });

  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(() => reject(new Error("PDF parsing timeout exceeded (60s).")), 60000)
  );

  return Promise.race([parsePromise, timeoutPromise]);
};

/**
 * Processes an actor's baseline document (journal entries, therapy notes, biography)
 * to extract psychological profile data using AI and stores results in Firestore.
 * @param request - HTTP request containing either a PDF file or text content for analysis
 * @returns JSON response indicating success with extraction count, or error status
 * @async
 */
export async function POST(request: Request) {
  try {
    // 1. Segurança e Autenticação
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token); 
    const userId = decodedToken.uid;

    // 2. Extração do Conteúdo (Arquivo ou Texto)
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const text = formData.get('text') as string | null;

    if (!file && !text) {
      return NextResponse.json({ error: 'No content provided' }, { status: 400 });
    }

    let finalContent = "";

    if (file) {
      // 1. Verificação se o arquivo é aceito
      const allowedTypes = [
        "application/pdf",
        "text/plain",
        "application/msword", 
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
      ];
      const isWordExt = file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.docx');

      if (!allowedTypes.includes(file.type) && !isWordExt) {
        return NextResponse.json({ error: 'Unsupported file type. Please upload PDF, TXT, or DOCX.' }, { status: 400 });
      }

      if (file.type === "application/pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        finalContent = await extractTextFromPDF(buffer);
      } else if (file.name.toLowerCase().endsWith(".docx") || file.type.includes("wordprocessingml")) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result = await mammoth.extractRawText({ buffer: buffer });
        finalContent = result.value;
      } else if (file.type.includes("text")) {
        finalContent = await file.text();
      } 
    } else if (text) {
      finalContent = text;
    }

    finalContent = finalContent.trim();
    if (finalContent.length < 50) {
      return NextResponse.json({ error: 'Content too short for AI analysis.' }, { status: 400 });
    }

    // 3. INICIALIZAÇÃO DA VERTEX AI PARA EXTRAÇÃO EM LOTE
    const { getAI, getGenerativeModel, VertexAIBackend, SchemaType } = await import("firebase/ai");
    const { getApp: getFirebaseApp } = await import("@/lib/firebase");

    const ai = getAI(getFirebaseApp(), { backend: new VertexAIBackend() });
    
    // Prompt específico para dissecação de documentos completos
    const BULK_SYSTEM_PROMPT = `
      You are an elite Psychological Profiler and Dramaturg. 
      You have been handed a raw, unfiltered baseline document (journal entries, therapy notes, or Personal biography) belonging to an actor.
      Your objective is to read this entire document and extract maximum psychological value to populate their "Unique Actor Profile".
      
      CRITICAL INSTRUCTIONS:
      - Be aggressive and comprehensive in your extraction. Do not leave valuable insights behind.
      - Read between the lines. If they describe a story about being ignored, extract the "unmet need for visibility" and the "core wound of neglect".
      - Identify the "Public Masks" they wear to survive their environments.
      - If the text does not contain information for a specific field, leave that array/string empty. Do not invent data.
    `;

    const extractionModel = getGenerativeModel(ai, {
      model: "gemini-2.5-pro",
      generationConfig: { temperature: 0.2 }, // low temperature so that it's analytical, not creative 
      // @ts-expect-error
      thinkingConfig: { thinkingLevel: "MEDIUM" },
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

                          baseline_summary: {
                            type: SchemaType.STRING,
                            description: "A cohesive, highly dense 2-to-3 paragraph psychological summary of the actor's entire uploaded life story. Distill the most important life events, their context, and the emotional baseline. This will serve as the AI Coach's core memory."
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


    const extractionResult = await extractionModel.generateContent(`
      ${BULK_SYSTEM_PROMPT}
      
      [ACTOR'S BASELINE DOCUMENT]
      """
      ${finalContent}
      """
      
      Execute the extraction function now based on the text above.
    `);

    let aiExtractions: ActorProfileExtraction | null = null
    const functionCalls = extractionResult.response.functionCalls(); 
    
    if (functionCalls && functionCalls.length > 0) {
        aiExtractions = functionCalls[0].args;
    }

    const userRecord = await auth.getUser(userId);
    const firstName = userRecord.displayName?.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") || "Actor";
    const userPath = `${userId}_${firstName}`;

    const profileRef = db.doc(`users/${userPath}/profile/master`);
    
    const updatePayload: DocumentData = {
      baselineHistory: finalContent,
      lastUpdated: FieldValue.serverTimestamp()
    };

    if (aiExtractions) {

      if (aiExtractions.baseline_summary) updatePayload['baselineSummary'] = aiExtractions.baseline_summary;
      if (aiExtractions.new_traits && aiExtractions.new_traits?.length > 0) updatePayload['psychology.traits'] = FieldValue.arrayUnion(...aiExtractions.new_traits);
      if (aiExtractions.defense_mechanisms && aiExtractions.defense_mechanisms?.length > 0) updatePayload['psychology.defenseMechanisms'] = FieldValue.arrayUnion(...aiExtractions.defense_mechanisms);
      if (aiExtractions.core_values && aiExtractions.core_values?.length > 0) updatePayload['psychology.coreValues'] = FieldValue.arrayUnion(...aiExtractions.core_values);
      if (aiExtractions.relational_dynamics && aiExtractions.relational_dynamics?.length > 0) updatePayload['psychology.relationalDynamics'] = FieldValue.arrayUnion(...aiExtractions.relational_dynamics);
      
      if (aiExtractions.milestones && aiExtractions.milestones?.length > 0) {
          const milestonesWithContext = aiExtractions.milestones.map((m: Milestone) => ({ ...m, section: "baseline_upload", discoveredAt: new Date().toISOString() }));
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

      if (aiExtractions.archetype_signals && aiExtractions.archetype_signals?.length > 0) updatePayload['acting_fuel.archetypes'] = FieldValue.arrayUnion(...aiExtractions.archetype_signals);
      if (aiExtractions.key_entities_and_arenas && aiExtractions.key_entities_and_arenas?.length > 0) updatePayload['history.keyEntities'] = FieldValue.arrayUnion(...aiExtractions.key_entities_and_arenas);
    }

    await profileRef.set(updatePayload, { merge: true });

    return NextResponse.json({ 
      success: true, 
      message: 'Baseline and AI Extractions saved successfully',
      extractionsCount: aiExtractions ? Object.keys(aiExtractions).length : 0 
    }, { status: 200 });

  } catch (error: unknown) {
    logger.error({ err: error, msg: 'Baseline Upload Error' });
    // Type narrowing 
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}