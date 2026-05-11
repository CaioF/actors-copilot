import { NextResponse } from "next/server";
import PDFParser from "pdf2json";
import mammoth from "mammoth";
import { AUDITION_COACH_PROMPT, COMMERCIAL_MODE_PROMPT, THEATHER_MODE_PROMPT } from "@/lib/prompts";
import { auth, db } from "@/lib/firebase.admin";
import { logger } from '@/lib/logger';
import { auditionFormDataSchema } from "@/lib/schemas/audition";
import type { CriticalBriefFact } from "@/lib/audition-types";

interface PerformanceMap {
  intro: string;
  sections: {
    title: string;
    items: string[];
  }[];
  outro: string;
  criticalBriefFacts?: CriticalBriefFact[];
}

/**
 * Parses a JSON-serialized CriticalBriefFact[] payload from the request form data.
 * Returns an empty array for any malformed input — this is additive enrichment, so
 * a bad payload must never fail the whole sides analysis.
 */
const parseCriticalBriefFactsPayload = (raw: string): CriticalBriefFact[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (fact): fact is CriticalBriefFact =>
        typeof fact === "object" &&
        fact !== null &&
        typeof (fact as CriticalBriefFact).label === "string" &&
        typeof (fact as CriticalBriefFact).value === "string" &&
        ((fact as CriticalBriefFact).importance === "critical" ||
          (fact as CriticalBriefFact).importance === "important")
    );
  } catch (error) {
    logger.warn({ err: error, msg: "Failed to parse criticalBriefFactsPayload; ignoring." });
    return [];
  }
};

/**
 * Safely extracts raw text content from a PDF buffer using pdf2json.
 * Includes a 80-second timeout to prevent malformed or malicious PDFs from hanging the server.
 * @param buffer - The PDF file content as a Node.js Buffer
 * @returns A promise resolving to the extracted text content
 * @async
 */
const extractTextFromPDF = (buffer: Buffer): Promise<string> => {
  const parsePromise = new Promise<string>((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);

    pdfParser.on("pdfParser_dataError", (errData) => {
      reject(errData.parserError);
    });

    pdfParser.on("pdfParser_dataReady", () => {
      const rawText = pdfParser.getRawTextContent();
      try {
        resolve(decodeURIComponent(rawText));
      } catch (error) {
        logger.warn({ err: error, msg: 'Failed to decode pdf text' });
        resolve(rawText);
      }
    });

    pdfParser.parseBuffer(buffer);
  });

  // Security: Kill the process if the PDF is too complex or acting as a "Zip Bomb"
  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(() => reject(new Error("PDF parsing timeout exceeded (80s). The file might be corrupted or too complex.")), 80000)
  );

  return Promise.race([parsePromise, timeoutPromise]);
};

/**
 * Analyzes audition materials (sides, project context) using AI to generate
 * a personalized performance coaching breakdown for an actor.
 * @param request - HTTP request containing form data with project type, sides text/file,
 *                  actor name, and user path for DNA profile lookup
 * @returns JSON response with structured performance coaching data or error
 * @async
 */
export async function POST(request: Request) {
  try {
    // 1. SECURITY & AUTHENTICATION (Token Verification)
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await auth.verifyIdToken(token);
    const authenticatedUserId = decodedToken.uid;

    // 2. EXTRACT INCOMING DATA AND FILES
    const formData = await request.formData();

    const textFields = {
      projectType: (formData.get("projectType") as string | null) ?? undefined,
      project: (formData.get("project") as string | null) ?? undefined,
      role: (formData.get("role") as string | null) ?? undefined,
      actorName: (formData.get("actorName") as string | null) ?? undefined,
      userPath: (formData.get("userPath") as string | null) ?? undefined,
      sidesText: (formData.get("sidesText") as string | null) ?? undefined,
      briefText: (formData.get("briefText") as string | null) ?? undefined,
      sidesFile: formData.get("sidesFile") as File | undefined,
      briefFile: formData.get("briefFile") as File | undefined,
      deadline: (formData.get("deadline") as string | null) ?? undefined,
      auditionTimezone: (formData.get("auditionTimezone") as string | null) ?? undefined,
      castingDirectorName: (formData.get("castingDirectorName") as string | null) ?? undefined,
      priorSidesSummary: (formData.get("priorSidesSummary") as string | null) ?? undefined,
      priorBriefSummary: (formData.get("priorBriefSummary") as string | null) ?? undefined,
      criticalBriefFactsPayload: (formData.get("criticalBriefFactsPayload") as string | null) ?? undefined,
    };

    const parseResult = auditionFormDataSchema.safeParse(textFields);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const validated = parseResult.data;
    const userPath = validated.userPath;
    const project = validated.project ?? "";
    const role = validated.role ?? "";
    const projectType = validated.projectType ?? "cinematic";
    const actorName = validated.actorName || "Actor";
    let sidesText = validated.sidesText ?? "";
    const deadline = validated.deadline ?? null;
    const auditionTimezone = validated.auditionTimezone ?? null;
    const castingDirectorName = (validated.castingDirectorName ?? "").trim();
    const priorBriefSummary = (validated.priorBriefSummary ?? "").substring(0, 1500).trim();
    const criticalBriefFacts = parseCriticalBriefFactsPayload(validated.criticalBriefFactsPayload ?? "");

    if (!userPath || !userPath.startsWith(`${authenticatedUserId}_`)) {
      logger.warn({
        msg: "SECURITY ALERT: Unauthorized access attempt",
        authenticatedUserId,
        userPath,
      });
      return NextResponse.json({ error: "Unauthorized access to this path." }, { status: 403 });
    }

    const sidesFile = formData.get("sidesFile") as File | null;

    if (sidesFile) {
      const arrayBuffer = await sidesFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      if (sidesFile.type === "application/pdf") {
        sidesText = await extractTextFromPDF(buffer);
      } else if (sidesFile.name.toLowerCase().endsWith(".docx") || sidesFile.type.includes("wordprocessingml")) {
        const result = await mammoth.extractRawText({ buffer: buffer });
        sidesText = result.value;
      }
    }

    if (!sidesText.trim()) {
      return NextResponse.json(
        { error: "No sides text or valid file provided for analysis." },
        { status: 400 }
      );
    }

    // FETCH THE ACTOR'S MASTER PROFILE (The Secret Sauce)
    const profileRef = db.doc(`users/${userPath}/profile/master`);
    const profileSnap = await profileRef.get();
    
    let actorDNAContext = "No DNA profile found. Provide high-level, generalized acting coaching based solely on the script.";
    
    if (profileSnap.exists) {
      const profileData = profileSnap.data();
      // Stringify the profile so the AI can read it as context
      actorDNAContext = JSON.stringify(profileData, null, 2);
    } 

    //special instruction based on project type
    let categoryInstruction = "";
    
    if (projectType === "commercial") {
        categoryInstruction = COMMERCIAL_MODE_PROMPT;
    } else if (projectType === "theater") {
        categoryInstruction = THEATHER_MODE_PROMPT;
    }
    
    // 5. INITIALIZE VERTEX AI FOR FIREBASE
    const { getAI, getGenerativeModel, VertexAIBackend, SchemaType } = await import("firebase/ai");
    const { getApp: getFirebaseApp } = await import("@/lib/firebase");

    const ai = getAI(getFirebaseApp(), { backend: new VertexAIBackend('global') });

    const model = getGenerativeModel(ai, { 
      model: "gemini-3.1-pro-preview", 
      systemInstruction: { role: "user", parts: [{ text: AUDITION_COACH_PROMPT }] },
      generationConfig: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            intro: { type: SchemaType.STRING },
            sections: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  title: { type: SchemaType.STRING },
                  items: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                },
                required: ["title", "items"]
              }
            },
            outro: { type: SchemaType.STRING },
            criticalBriefFacts: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  label: { type: SchemaType.STRING },
                  value: { type: SchemaType.STRING },
                  importance: { type: SchemaType.STRING }
                },
                required: ["label", "value", "importance"]
              }
            }
          },
          required: ["intro", "sections", "outro"]
        }
      }
    });

    // 6. COMPILE PAYLOAD FOR AI
    const prompt = `
      You are coaching ${actorName}. 

      ${categoryInstruction}
      
      <actor_dna>
      CRITICAL INSTRUCTION: You MUST use this profile as the psychological lens for your entire breakdown. 
      Do not just tack it on at the end. Weave their specific emotional triggers, strengths, and past 
      tendencies into the Coach Notes and Tactics.
      
      ${actorDNAContext}
      </actor_dna>
      
      Here are the audition materials for analysis:

      <context>
      - Project Category: ${projectType.toUpperCase()}
      - Project: ${project || "Not specified"}
      - Role: ${role || "Not specified"}
      ${deadline ? `- Deadline: ${deadline}` : ""}
      ${auditionTimezone ? `- Project Timezone: ${auditionTimezone}` : ""}
      ${castingDirectorName ? `- Casting Director (named by the actor): ${castingDirectorName}` : ""}
      </context>

      <audition_sides>
      ${sidesText || "No sides provided."}
      </audition_sides>
      
      ${priorBriefSummary ? `\n<prior_brief_analysis>\n${priorBriefSummary}\n</prior_brief_analysis>` : ""}

      ${criticalBriefFacts.length > 0 ? `\n<critical_brief_facts>\nThe casting brief explicitly surfaced the following critical facts. They are non-negotiable and must be honored verbatim even if absent from the sides. Weave each one into the appropriate section AND echo them in the dedicated "criticalBriefFacts" output array exactly as given (do not summarize, rephrase, or drop any).\n${criticalBriefFacts
        .map((fact) => `- [${fact.importance.toUpperCase()}] ${fact.label}: ${fact.value}`)
        .join("\n")}\n</critical_brief_facts>` : ""}

      CRITICAL: Do not summarize. Write expansive, multi-paragraph analyses for every section. If a section allows it, explicitly name a trait from the actor's DNA and explain how it alters their tactics here.
    `;

    // EXECUTE AI INFERENCE AND PARSE RESPONSE
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let performanceMap: PerformanceMap;
    try {
        performanceMap = JSON.parse(responseText) as PerformanceMap;
    } catch (parseError) {
        logger.error({ err: parseError, msg: 'Failed to parse AI JSON output' });
        return NextResponse.json({ error: 'AI returned malformed data.' }, { status: 502 });
    }

    // RETURN TO FRONTEND
    return NextResponse.json({
      success: true,
      message: "Performance Map generated successfully.",
      data: performanceMap,
    });

  } catch (error) {
    logger.error({ err: error, msg: 'Error during Audition synthesis' });
    return NextResponse.json(
      { success: false, error: "Internal Server Error during synthesis." },
      { status: 500 }
    );
  }
}
