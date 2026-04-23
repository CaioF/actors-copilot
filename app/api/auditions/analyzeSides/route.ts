import { NextResponse } from "next/server";
import PDFParser from "pdf2json";
import mammoth from "mammoth";
import { AUDITION_COACH_PROMPT, COMMERCIAL_MODE_PROMPT, THEATHER_MODE_PROMPT } from "@/lib/prompts";
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
      resolve(decodeURIComponent(rawText));
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
    const projectType = formData.get("projectType") as string || "cinematic"; // Default to cinematic if not provided
    // Security: Bound string lengths to prevent excessive token usage (native prompt injection mitigation)
    const rawProject = formData.get("project") as string || "";
    const rawRole = formData.get("role") as string || "";
    const project = rawProject.substring(0, 150).trim(); 
    const role = rawRole.substring(0, 100).trim();
    const deadline = formData.get("deadline") as string;
    
    // Extract routing and personalization parameters
    const userPath = formData.get("userPath") as string;
    const actorName = formData.get("actorName") as string || "Actor";

    let sidesText = (formData.get("sidesText") as string) || "";

    const sidesFile = formData.get("sidesFile") as File | null;

    // Security Check: Ensure the requested userPath belongs to the authenticated user
    // Performed before any expensive file parsing to reject unauthorized requests early.
    if (!userPath || !userPath.startsWith(`${authenticatedUserId}_`)) {
      logger.warn({ authenticatedUserId, userPath, msg: `SECURITY ALERT: User ${authenticatedUserId} attempted to generate an audition for ${userPath}` });
      return NextResponse.json({ error: "Unauthorized access to this path." }, { status: 403 });
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

    if (sidesFile) {
      if (sidesFile.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File exceeds 20MB limit" },
          { status: 413 }
        );
      }

      const isDocx = sidesFile.name.toLowerCase().endsWith('.docx');

      if (!ALLOWED_MIME_TYPES.includes(sidesFile.type) && !isDocx) {
        return NextResponse.json(
          { error: "Only PDFs and Word documents (.docx) are allowed" },
          { status: 400 }
        );
      }
    }

    // 3. PARSE FILES SAFELY (PDFs & DOCX)
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

    // 4. FETCH THE ACTOR'S MASTER PROFILE (The Secret Sauce)
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
            outro: { type: SchemaType.STRING }
          },
          required: ["intro", "sections", "outro"]
        } 
      }
    });

    // 6. COMPILE PAYLOAD FOR AI
    const prompt = `
      You are coaching ${actorName}. 

      ${categoryInstruction}
      
      === ACTOR'S DNA VAULT (MASTER PROFILE) ===
      CRITICAL INSTRUCTION: You MUST use this profile as the psychological lens for your entire breakdown. 
      Do not just tack it on at the end. Weave their specific emotional triggers, strengths, and past 
      tendencies into the Coach Notes and Tactics.
      
      ${actorDNAContext}
      ==========================================
      
      Here are the audition materials for analysis:

      CONTEXT:
      - Project Category: ${projectType.toUpperCase()}
      - Project: ${project || "Not specified"}

      AUDITION SIDES (SCRIPT):
      ${sidesText || "No sides provided."}

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