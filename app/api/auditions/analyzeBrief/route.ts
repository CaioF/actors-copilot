import { NextResponse } from "next/server";
import PDFParser from "pdf2json";
import mammoth from "mammoth";
import { BRIEF_ANALYSIS_PROMPT, BRIEF_CINEMATIC_PROMPT, BRIEF_COMMERCIAL_PROMPT, BRIEF_THEATER_PROMPT } from "@/lib/prompts";
import { auth, db } from "@/lib/firebase.admin";
import { logger } from '@/lib/logger';

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // .docx
];

interface PerformanceMap {
  intro: string;
  sections: {
    title: string;
    items: string[];
  }[];
  outro: string;
}

/**
 * Safely extracts raw text content from a PDF buffer using pdf2json.
 * Includes a 60-second timeout to prevent malformed or malicious PDFs from hanging the server.
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
    setTimeout(() => reject(new Error("PDF parsing timeout exceeded (60s). The file might be corrupted or too complex.")), 60000)
  );

  return Promise.race([parsePromise, timeoutPromise]);
};

/**
 * Analyzes character briefs and casting notes using AI to generate
 * a personalized character conception and world-building map for the actor.
 * @param request - HTTP request containing form data with project type, brief text/file,
 * actor name, and user path for DNA profile lookup
 * @returns JSON response with structured breakdown data or error
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
    
    // Explicitly reject sidesFile to prevent accidental misuse of the endpoint
    if (formData.has("sidesFile")) {
      return NextResponse.json(
        { error: "This endpoint is strictly for Brief analysis. Do not send 'sidesFile'." },
        { status: 400 }
      );
    }

    const projectType = formData.get("projectType") as string || "cinematic"; 
    
    // Security: Bound string lengths to prevent excessive token usage
    const rawProject = formData.get("project") as string || "";
    const rawRole = formData.get("role") as string || "";
    const project = rawProject.substring(0, 150).trim(); 
    const role = rawRole.substring(0, 100).trim();
    
    // Extract routing and personalization parameters
    const userPath = formData.get("userPath") as string;
    const actorName = formData.get("actorName") as string || "Actor";

    let briefText = (formData.get("briefText") as string) || "";
    const briefFile = formData.get("briefFile") as File | null;

    const deadline = (formData.get("deadline") as string)?.substring(0, 50).trim() || null;
    const auditionTimezone = (formData.get("auditionTimezone") as string)?.substring(0, 50).trim() || null;

    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

    // Validate the Brief File
    if (briefFile) {
      if (briefFile.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Brief file exceeds 20MB limit" },
          { status: 413 }
        );
      }

      const isDocx = briefFile.name.toLowerCase().endsWith('.docx');

      if (!ALLOWED_MIME_TYPES.includes(briefFile.type) && !isDocx) {
        return NextResponse.json(
          { error: "Only PDFs and Word documents (.docx) are allowed for the brief." },
          { status: 400 }
        );
      }
    }

    // Security Check: Ensure the requested userPath belongs to the authenticated user
    if (!userPath || !userPath.startsWith(`${authenticatedUserId}_`)) {
      logger.warn({ authenticatedUserId, userPath, msg: `SECURITY ALERT: User ${authenticatedUserId} attempted to generate a brief for ${userPath}` });
      return NextResponse.json({ error: "Unauthorized access to this path." }, { status: 403 });
    }

    // 3. PARSE FILES SAFELY (PDFs & DOCX)
    if (briefFile) {
      const arrayBuffer = await briefFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      if (briefFile.type === "application/pdf") {
        briefText = await extractTextFromPDF(buffer);
      } else if (briefFile.name.toLowerCase().endsWith(".docx") || briefFile.type.includes("wordprocessingml")) {
        const result = await mammoth.extractRawText({ buffer: buffer });
        briefText = result.value;
      }
    }

    // Ensure we have something to analyze
    if (!briefText.trim()) {
       return NextResponse.json(
         { error: "No brief text or valid file provided for analysis." },
         { status: 400 }
       );
    }

    // 4. FETCH THE ACTOR'S MASTER PROFILE (The Secret Sauce)
    const profileRef = db.doc(`users/${userPath}/profile/master`);
    const profileSnap = await profileRef.get();
    
    let actorDNAContext = "No DNA profile found. Provide high-level, generalized character breakdown based solely on the brief.";
    
    if (profileSnap.exists) {
      const profileData = profileSnap.data();
      // Stringify the profile so the AI can read it as context
      actorDNAContext = JSON.stringify(profileData, null, 2);
    } 

    // Special instruction based on project type
    let categoryInstruction = "";
    if (projectType === "commercial") {
        categoryInstruction = BRIEF_COMMERCIAL_PROMPT;
    } else if (projectType === "theater") {
        categoryInstruction = BRIEF_THEATER_PROMPT;
    } else if (projectType === "cinematic") {
        categoryInstruction = BRIEF_CINEMATIC_PROMPT;
    }

    // 5. INITIALIZE VERTEX AI FOR FIREBASE
    const { getAI, getGenerativeModel, VertexAIBackend, SchemaType } = await import("firebase/ai");
    const { getApp: getFirebaseApp } = await import("@/lib/firebase");

    const ai = getAI(getFirebaseApp(), { backend: new VertexAIBackend('global') });

    const model = getGenerativeModel(ai, { 
      model: "gemini-3.1-pro-preview", 
      systemInstruction: { role: "user", parts: [{ text: BRIEF_ANALYSIS_PROMPT }] }, 
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
            outro: { type: SchemaType.STRING }
          },
          required: ["intro", "sections", "outro"]
        } 
      }
    });

    // 6. COMPILE PAYLOAD FOR AI
    // Adjusted prompt payload strictly for briefs, director notes, and character archetypes
    const prompt = `
      You are coaching ${actorName} on how to build a character and understand the world of this project.

      ${categoryInstruction}
      
      === ACTOR'S DNA VAULT (MASTER PROFILE) ===
      CRITICAL INSTRUCTION: You MUST use this profile as the psychological lens. 
      Identify which specific traits, past experiences, or emotional reservoirs from their DNA 
      perfectly align with the director's vision and character archetype described below.
      
      ${actorDNAContext}
      ==========================================
      
      Here are the casting materials for analysis:

      CONTEXT:
      - Project Category: ${projectType.toUpperCase()}
      - Project: ${project || "Not specified"}
      - Role: ${role || "Not specified"}
      ${deadline ? `- Deadline: ${deadline}` : ""}
      ${auditionTimezone ? `- Project Timezone: ${auditionTimezone}` : ""}

      CHARACTER BRIEF / CASTING NOTES:
      ${briefText}
    `;

    // 7. EXECUTE AI INFERENCE AND PARSE RESPONSE
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let performanceMap: PerformanceMap;
    try {
        performanceMap = JSON.parse(responseText) as PerformanceMap;
    } catch (parseError) {
        logger.error({ err: parseError, msg: 'Failed to parse AI JSON output' });
        return NextResponse.json({ error: 'AI returned malformed data.' }, { status: 502 });
    }

    // 8. RETURN TO FRONTEND
    return NextResponse.json({
      success: true,
      message: "Brief Map generated successfully.",
      data: performanceMap,
    });

  } catch (error) {
    logger.error({ err: error, msg: 'Error during Brief synthesis' });
    return NextResponse.json(
      { success: false, error: "Internal Server Error during brief synthesis." },
      { status: 500 }
    );
  }
}