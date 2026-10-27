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
 * TTS models to attempt, in order.
 *
 * `gemini-3.1-flash-tts-preview` is the model used by the current Firebase AI
 * Logic text-to-speech guide. The 2.5 models are kept as fallbacks because
 * they are the ones available on the Agent Platform (Vertex AI) endpoints and
 * they are being retired during October 2026.
 */
const CANDIDATE_MODELS = [
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-flash-tts",
  "gemini-2.5-pro-tts",
];

/**
 * Gemini 3 models do not accept `temperature`, so it is only sent for the
 * 2.5 generation.
 */
function supportsTemperature(modelName: string): boolean {
  return modelName.includes("2.5");
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

    // Gemini answers with 400 INVALID_ARGUMENT for unknown prebuilt voices, so
    // the requested voice is validated against the official list before the
    // request is sent.
    const { resolveGeminiVoice } = await import("@/lib/actor-copilot/script-parser");
    const selectedVoice = resolveGeminiVoice(voiceName);

    const performancePrompt = `Act as ${speakerName}. ${emotionNote ? `Tone: ${emotionNote}. ` : ""}Perform line naturally without extra commentary. Speak EXACTLY:\n"${text.trim()}"`;

    const { getAI, getGenerativeModel, VertexAIBackend } = await import("firebase/ai");
    // `getAiApp` returns a Firebase Server App bound to an App Check token.
    // Gemini TTS models are only reachable through Firebase AI Logic when the
    // request carries that token, otherwise the proxy answers 403.
    const { getAiApp } = await import("@/lib/firebase-ai");

    const ai = getAI(await getAiApp(), { backend: new VertexAIBackend("global") });

    let lastError: any = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const generationConfig: Record<string, unknown> = {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoice,
              },
            },
          },
        };

        if (supportsTemperature(modelName)) {
          generationConfig.temperature = 0.2;
        }

        const ttsModel = getGenerativeModel(ai, {
          model: modelName,
          generationConfig: generationConfig as any,
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

        lastError = new Error(`Model ${modelName} returned no audio content.`);
      } catch (err: any) {
        lastError = err;
        logger.warn({
          msg: `Model ${modelName} TTS generation failed, attempting next candidate.`,
          err: err?.message || err,
        });
        // Continue to next candidate model
      }
    }

    // If all models failed, surface the real reason instead of a generic 500.
    const errorMessage: string =
      lastError?.message || (lastError ? String(lastError) : "Unknown error");
    const isQuota =
      errorMessage.includes("Quota exceeded") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("429");
    const isAppCheck =
      errorMessage.includes("App Check") || errorMessage.includes("appcheck");

    if (isAppCheck) {
      logger.error({
        msg: "Gemini TTS rejected the request because Firebase App Check is not enforced.",
        err: errorMessage,
      });
      return NextResponse.json(
        {
          success: false,
          error:
            "Voice synthesis requires Firebase App Check. Enforce App Check for the Firebase AI Logic API in the Firebase console and try again.",
          code: "APP_CHECK_REQUIRED",
        },
        { status: 503 }
      );
    }

    logger.error({
      msg: "All Gemini TTS candidates failed.",
      err: errorMessage,
    });

    return NextResponse.json(
      {
        success: false,
        error: isQuota
          ? "Voice synthesis quota temporarily reached. Rehearsal will continue."
          : "Could not generate speech audio.",
        detail: isQuota ? undefined : errorMessage,
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
