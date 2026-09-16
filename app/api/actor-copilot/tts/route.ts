import { NextResponse } from "next/server";
import { auth } from "@/lib/firebase.admin";
import { logger } from "@/lib/logger";

/**
 * Creates a standard WAV header for raw 24kHz 16-bit Mono PCM audio data.
 */
function wrapPcmInWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const wavBuffer = Buffer.alloc(headerSize + dataSize);

  wavBuffer.write("RIFF", 0);
  wavBuffer.writeUInt32LE(36 + dataSize, 4);
  wavBuffer.write("WAVE", 8);

  wavBuffer.write("fmt ", 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20);
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  wavBuffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  wavBuffer.writeUInt16LE(bitsPerSample, 34);

  wavBuffer.write("data", 36);
  wavBuffer.writeUInt32LE(dataSize, 40);

  pcmBuffer.copy(wavBuffer, headerSize);

  return wavBuffer;
}

/**
 * Generates expressive performance TTS audio using Gemini Flash models with automatic model fallback resilience.
 */
export async function POST(request: Request) {
  try {
    // 1. SECURITY & AUTHENTICATION
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    await auth.verifyIdToken(token);

    // 2. PARSE REQUEST DATA
    const body = await request.json();
    const { text, character, emotionNote, voiceName } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Missing text for TTS" }, { status: 400 });
    }

    const speakerName = character || "AI Character";
    const selectedVoice = voiceName || "Puck";

    const performancePrompt = `Act as ${speakerName}. ${emotionNote ? `Tone: ${emotionNote}. ` : ""}Perform line naturally without extra commentary. Speak EXACTLY:\n"${text.trim()}"`;

    const { getAI, getGenerativeModel, VertexAIBackend } = await import("firebase/ai");
    const { getApp: getFirebaseApp } = await import("@/lib/firebase");

    const ai = getAI(getFirebaseApp(), { backend: new VertexAIBackend("global") });

    // Models to attempt in sequence (Primary working TTS model for Vertex AI)
    const candidateModels = ["gemini-2.5-flash-tts"];

    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const ttsModel = getGenerativeModel(ai, {
          model: modelName,
          generationConfig: {
            temperature: 0.2,
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: selectedVoice,
                },
              },
            },
          } as any,
        });

        const result = await ttsModel.generateContent(performancePrompt);
        const candidates = result.response.candidates;
        const parts = candidates?.[0]?.content?.parts || [];

        let audioData: string | null = null;
        let mimeType = "audio/mp3";

        for (const part of parts) {
          if ("inlineData" in part && part.inlineData) {
            audioData = part.inlineData.data;
            if (part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            break;
          }
        }

        if (audioData) {
          let finalDataUrl: string;
          if (mimeType.includes("pcm") || mimeType.includes("raw") || mimeType.includes("l16")) {
            const pcmBuffer = Buffer.from(audioData, "base64");
            const wavBuffer = wrapPcmInWav(pcmBuffer, 24000, 1, 16);
            finalDataUrl = `data:audio/wav;base64,${wavBuffer.toString("base64")}`;
          } else {
            finalDataUrl = `data:${mimeType};base64,${audioData}`;
          }

          return NextResponse.json({
            success: true,
            audioUrl: finalDataUrl,
            voiceName: selectedVoice,
            modelUsed: modelName,
          });
        }
      } catch (err: any) {
        lastError = err;
        logger.warn({
          msg: `Model ${modelName} TTS generation failed, attempting next candidate.`,
          err: err?.message || err,
        });
        // Continue to next candidate model
      }
    }

    // If all models failed, return clean 429/500 error payload
    const isQuota = lastError?.message?.includes("Quota exceeded") || lastError?.message?.includes("429");
    return NextResponse.json(
      {
        success: false,
        error: isQuota
          ? "Voice synthesis quota temporarily reached. Rehearsal will continue."
          : "Could not generate speech audio.",
      },
      { status: isQuota ? 429 : 500 }
    );
  } catch (error: any) {
    logger.error({ err: error, msg: "Error during TTS endpoint execution" });
    return NextResponse.json(
      { success: false, error: "Internal Server Error during TTS synthesis." },
      { status: 500 }
    );
  }
}
