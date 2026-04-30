import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase.admin'; 
import { FieldValue, DocumentData } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger';

/**
 * Represents a single message within the coaching session.
 */
interface ChatMessage {
  role: 'user' | 'assistant' | 'coach' | 'system';
  content: string;
}

/**
 * The expected payload for the DNA Update request.
 */
interface UpdateDnaRequestPayload {
  sessionId?: string;
  messages: ChatMessage[];
}

/**
 * Represents the structured psychological data extracted by the AI.
 * Strict typing ensures type safety when mapping to Firestore fields.
 */
interface DnaExtractionResult {
  is_valuable_extraction: boolean;
  new_traits?: string[];
  defense_mechanisms?: string[];
  core_values?: string[];
  relational_dynamics?: string[];
  core_wounds_and_fears?: string[];
  unmet_needs?: string[];
  public_masks?: string[];
  archetype_signals?: string[];
  key_entities_and_arenas?: string[];
  progress_assessment: {
    has_actionable_pattern: boolean;
    depth_score: number;
  };
}

/**
 * Validates the incoming request body against the expected payload structure.
 * @param body - The unparsed JSON body from the request.
 * @returns A boolean indicating whether the body is a valid UpdateDnaRequestPayload.
 */
function isValidPayload(body: unknown): body is UpdateDnaRequestPayload {
  if (!body || typeof body !== 'object') return false;
  const payload = body as Record<string, unknown>;
  
  if (!Array.isArray(payload.messages)) return false;
  
  // Validate that every message has a role and content
  const isValidMessages = payload.messages.every((msg: unknown) => {
    if (!msg || typeof msg !== 'object') return false;
    const m = msg as Record<string, unknown>;
    return typeof m.role === 'string' && typeof m.content === 'string';
  });

  return isValidMessages;
}

/**
 * POST handler for extracting psychological DNA from a chat session and updating the Master Profile.
 * Evaluates the conversation transcript using Vertex AI and persists new findings to Firestore.
 */
export async function POST(request: Request) {
  try {
    // 1. Security & Authentication Authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token); 
    const userId = decodedToken.uid;

    // 2. Payload Extraction and Strict Validation
    const body: unknown = await request.json();
    
    if (!isValidPayload(body)) {
      return NextResponse.json({ error: 'Bad Request: Invalid payload structure' }, { status: 400 });
    }

    const { sessionId, messages } = body;

    if (messages.length === 0) {
      return NextResponse.json({ message: 'No new messages to analyze' }, { status: 200 });
    }

    // 3. Transcript Formatting
    const conversationTranscript = messages
      .filter(msg => msg.content.trim().length > 0)
      .map(msg => `${msg.role === 'user' ? 'Actor' : 'Coach'}: ${msg.content}`)
      .join('\n\n');

    if (conversationTranscript.length < 50) {
      return NextResponse.json({ message: 'Conversation too short for meaningful analysis.' }, { status: 200 });
    }

    // 4. Vertex AI Initialization
    const { getAI, getGenerativeModel, VertexAIBackend, SchemaType } = await import("firebase/ai");
    const { getApp: getFirebaseApp } = await import("@/lib/firebase");

    const ai = getAI(getFirebaseApp(), { backend: new VertexAIBackend('global') });
    
    // Explicit directive against acting terminology based on strict user constraints
    const CONVERSATION_ANALYSIS_PROMPT = `
      You are an elite Psychological Profiler. 
      You are analyzing a recent coaching conversation between an Actor and their Coach.
      Your objective is to read this transcript and extract NEW, actionable psychological value to populate their "DNA Vault".
      
      CRITICAL INSTRUCTIONS:
      - Only extract new insights. If the conversation is just small talk or logistics, return a negative progress assessment.
      - Read between the lines. Identify subtext, core wounds, unmet needs, or defense mechanisms revealed in how the actor speaks.
      - ABSOLUTE CONSTRAINT: Do NOT use acting-related terms, acting jargon, or performance vocabulary in your extraction output. Focus strictly on human psychology, life history, and emotional baselines.
    `;

    const extractionModel = getGenerativeModel(ai, {
      model: "gemini-2.5-pro",
      generationConfig: { temperature: 0.2 },
      // @ts-expect-error - thinkingConfig is experimental in some SDK versions
      thinkingConfig: { thinkingLevel: "MEDIUM" },
      tools: [{
        functionDeclarations: [{
            name: "update_master_profile",
            description: "Analyzes the conversation transcript to extract NEW psychological data.",
            parameters: {
                type: SchemaType.OBJECT, 
                properties: {
                    is_valuable_extraction: { 
                        type: SchemaType.BOOLEAN, 
                        description: "TRUE if the user provided new, deep psychological insights. FALSE if superficial." 
                    },
                    new_traits: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    defense_mechanisms: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    core_values: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    relational_dynamics: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    core_wounds_and_fears: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    unmet_needs: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    public_masks: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    archetype_signals: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    key_entities_and_arenas: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    progress_assessment: {
                        type: SchemaType.OBJECT,
                        properties: {
                            has_actionable_pattern: { type: SchemaType.BOOLEAN },
                            depth_score: { type: SchemaType.NUMBER }
                        },
                        required: ["has_actionable_pattern", "depth_score"]
                    }
                },
                required: ["progress_assessment", "is_valuable_extraction"]
            }
        }]
      }]
    }); 

    // 5. Inference Execution
    const extractionResult = await extractionModel.generateContent(`
      ${CONVERSATION_ANALYSIS_PROMPT}
      
      [CONVERSATION TRANSCRIPT]
      """
      ${conversationTranscript}
      """
      
      Execute the extraction function now based on the transcript above.
    `);

    let aiExtractions: DnaExtractionResult | null = null;
    const functionCalls = extractionResult.response.functionCalls(); 
    
    if (functionCalls && functionCalls.length > 0) {
        // We confidently cast here because the AI response is bound to the Schema declaration
        aiExtractions = functionCalls[0].args as unknown as DnaExtractionResult;
    }

    // 6. Early Exit for Low-Value Transcripts
    if (!aiExtractions || !aiExtractions.is_valuable_extraction || !aiExtractions.progress_assessment?.has_actionable_pattern) {
        return NextResponse.json({ 
            success: true, 
            message: 'No new actionable patterns found in this transcript.',
            extractionsCount: 0 
        }, { status: 200 });
    }

    // 7. Firestore Update Compilation
    const userRecord = await auth.getUser(userId);
    const firstName = userRecord.displayName?.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") || "Actor";
    const userPath = `${userId}_${firstName}`;

    const profileRef = db.doc(`users/${userPath}/profile/master`);
    const updatePayload: DocumentData = {
      lastDnaUpdate: FieldValue.serverTimestamp()
    };

    // Helper to safely append to Firestore arrays only if data exists
    const appendIfPresent = (data: string[] | undefined, fieldPath: string) => {
      if (data && Array.isArray(data) && data.length > 0) {
        updatePayload[fieldPath] = FieldValue.arrayUnion(...data);
      }
    };

    appendIfPresent(aiExtractions.new_traits, 'psychology.traits');
    appendIfPresent(aiExtractions.defense_mechanisms, 'psychology.defenseMechanisms');
    appendIfPresent(aiExtractions.core_values, 'psychology.coreValues');
    appendIfPresent(aiExtractions.relational_dynamics, 'psychology.relationalDynamics');
    appendIfPresent(aiExtractions.core_wounds_and_fears, 'acting_fuel.coreWounds');
    appendIfPresent(aiExtractions.unmet_needs, 'acting_fuel.unmetNeeds');
    appendIfPresent(aiExtractions.public_masks, 'acting_fuel.publicMasks');
    appendIfPresent(aiExtractions.archetype_signals, 'acting_fuel.archetypes');
    appendIfPresent(aiExtractions.key_entities_and_arenas, 'history.keyEntities');

    // Execute the Master Profile Merge
    await profileRef.set(updatePayload, { merge: true });

    // Optional: Log the analysis timestamp at the session level to prevent duplicate processing
    if (sessionId) {
       const sessionRef = db.doc(`users/${userPath}/sessions/${sessionId}`);
       await sessionRef.set({ lastDnaAnalysis: FieldValue.serverTimestamp() }, { merge: true });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'DNA Vault updated successfully',
      extractionsCount: Object.keys(aiExtractions).length
    }, { status: 200 });

  } catch (error: unknown) {
    logger.error({ err: error, msg: 'DNA Chat Update Error' });
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}