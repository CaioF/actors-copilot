import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase.admin';

/**
 * Transcribes audio input (typically voice recordings for chat input) to text using AI.
 * @param request - HTTP request with authorization token, base64-encoded audio, and mime type
 * @returns JSON response with transcribed text or error message
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
    await auth.verifyIdToken(token); 

    // Get audio
    const body = await request.json();
    const { audioBase64, mimeType } = body;

    if (!audioBase64) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }

    // initialize fast AI
    const { getAI, getGenerativeModel, VertexAIBackend } = await import("firebase/ai");
    const { getApp: getFirebaseApp } = await import("@/lib/firebase");
    const ai = getAI(getFirebaseApp(), { backend: new VertexAIBackend() });
    
    // transcription
    const transcriptionModel = getGenerativeModel(ai, {
      model: "gemini-2.5-flash",
      generationConfig: { temperature: 0.1 }, 
    } as any);

    const audioPart = {
      inlineData: { data: audioBase64, mimeType: mimeType || "audio/webm" }
    };

    console.log("Transcrevendo áudio rápido para o ChatInput...");
    
    const transcriptionResult = await transcriptionModel.generateContent([
      "Transcribe this audio exactly as spoken. Do not add any conversational filler. Return only the raw text.", 
      audioPart
    ]);
    
    const transcribedText = transcriptionResult.response.text().trim();

    if (transcribedText.length < 2) {
      return NextResponse.json({ error: 'Audio too short or silent' }, { status: 400 });
    }

    return NextResponse.json({ text: transcribedText }, { status: 200 });

  } catch (error: any) {
    console.error("Transcription Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}