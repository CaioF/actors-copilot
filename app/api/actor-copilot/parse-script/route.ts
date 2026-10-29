import { NextResponse } from "next/server";
import { auth, db } from "@/lib/firebase.admin";
import { logger } from "@/lib/logger";
import type { SceneData } from "@/lib/actor-copilot/script-parser";

/**
 * API route to parse raw audition sides/script text into structured scene dialogue for rehearsal.
 */
export async function POST(request: Request) {
  try {
    // 1. SECURITY & AUTHENTICATION
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await auth.verifyIdToken(token);
    const authenticatedUserId = decodedToken.uid;

    const body = await request.json();
    let sidesText = body.sidesText as string | undefined;
    const auditionId = body.auditionId as string | undefined;
    const userPath = body.userPath as string | undefined;

    if ((userPath && (userPath.includes("/") || userPath.includes(".."))) || (auditionId && auditionId.includes("/"))) {
      return NextResponse.json({ error: "Invalid path parameters" }, { status: 400 });
    }
    // If auditionId and userPath provided, verify access and load sidesText from Firestore if needed
    if (auditionId && userPath) {
      if (!userPath.startsWith(`${authenticatedUserId}_`)) {
        return NextResponse.json({ error: "Unauthorized path access" }, { status: 403 });
      }

      if (!sidesText) {
        const docRef = db.doc(`users/${userPath}/auditions/${auditionId}`);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const data = docSnap.data();
          sidesText = data?.sidesText || "";
        }
      }
    }

    if (!sidesText || !sidesText.trim()) {
      return NextResponse.json({ error: "No script or sides text provided for rehearsal." }, { status: 400 });
    }

    // 2. INITIALIZE VERTEX AI / GEMINI FOR STRUCTURED SCRIPT PARSING
    const { getAI, getGenerativeModel, VertexAIBackend, SchemaType } = await import("firebase/ai");
    const { getAiApp } = await import("@/lib/firebase-ai");

    const ai = getAI(await getAiApp(), { backend: new VertexAIBackend("global") });

    const parserModel = getGenerativeModel(ai, {
      model: "gemini-3-flash-preview",
      systemInstruction: {
        role: "user",
        parts: [
          {
            text: `You are an expert script supervisor and theatrical parser. 
Your task is to parse script sides into a clean, ordered sequence of character dialogue lines for interactive actor rehearsal.

RULES:
1. Extract every spoken dialogue line in the exact chronological order as written in the script.
2. Maintain exact character speaker names (e.g., "SARAH", "JOHN"). Normalize character names to UPPERCASE.
3. Preserve the exact dialogue wording, punctuation, and intent of each line.
4. Extract all unique character names present in the scene.
5. Provide a brief emotion/tone note for each line (e.g. "tense, defensive", "whispering", "sarcastic", "hopeful") based on scene context.
6. Provide a descriptive title for the scene (e.g. "Scene 1: Living Room").
7. Preserve EVERY stage direction / action description (non-dialogue narrative text such as "Emily takes out her phone and unlocks it slowly.") exactly as written. Never drop, merge, summarize, rewrite or translate them. Stage directions are NOT dialogue lines and are NOT assigned to any character.
8. Put each stage direction in the "directionsBefore" array of the dialogue line that FOLLOWS it in the script, keeping the original order. If several stage directions appear in a row, list them all in order. Stage directions that appear after the last dialogue line go in the top-level "trailingDirections" array. Do not repeat a stage direction anywhere else. Do not include stage directions inside "dialogue".`,
          },
        ],
      },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            sceneTitle: { type: SchemaType.STRING },
            characters: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
            lines: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  character: { type: SchemaType.STRING },
                  dialogue: { type: SchemaType.STRING },
                  emotionNote: { type: SchemaType.STRING },
                  directionsBefore: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                  },
                },
                required: ["character", "dialogue"],
              },
            },
            trailingDirections: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
            },
          },
          required: ["sceneTitle", "characters", "lines"],
        },
      },
    });

    const prompt = `Please parse the following script text into structured scene lines:\n\n${sidesText.trim()}`;
    const result = await parserModel.generateContent(prompt);
    const responseText = result.response.text();

    const parsed = JSON.parse(responseText) as {
      sceneTitle: string;
      characters: string[];
      lines: Array<{
        character: string;
        dialogue: string;
        emotionNote?: string;
        directionsBefore?: string[];
      }>;
      trailingDirections?: string[];
    };

    const cleanDirections = (directions?: string[]) => {
      const cleaned = (directions ?? []).map((d) => d.trim()).filter(Boolean);
      return cleaned.length > 0 ? cleaned : undefined;
    };

    const sceneId = auditionId || `scene_${Date.now()}`;
    const formattedCharacters = Array.from(
      new Set(parsed.characters.map((c) => c.toUpperCase().trim()))
    ).filter(Boolean);

    const formattedLines = parsed.lines.map((item, index) => ({
      id: `${sceneId}_line_${index}`,
      character: item.character.toUpperCase().trim(),
      dialogue: item.dialogue.trim(),
      order: index,
      emotionNote: item.emotionNote || undefined,
      directionsBefore: cleanDirections(item.directionsBefore),
    }));

    const scene: SceneData = {
      sceneId,
      title: parsed.sceneTitle || "Scene Rehearsal",
      characters: formattedCharacters,
      lines: formattedLines,
      trailingDirections: cleanDirections(parsed.trailingDirections),
    };

    return NextResponse.json({
      success: true,
      scene,
    });
  } catch (error) {
    logger.error({ err: error, msg: "Error parsing script for Actor Copilot" });
    return NextResponse.json(
      { success: false, error: "Failed to parse script." },
      { status: 500 }
    );
  }
}
