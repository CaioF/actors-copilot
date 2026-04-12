import { NextResponse } from "next/server";
import PDFParser from "pdf2json";
import mammoth from "mammoth";
import { AUDITION_COACH_PROMPT, COMMERCIAL_MODE_PROMPT, THEATHER_MODE_PROMPT } from "@/lib/prompts";
// IMPORT THE ADMIN SDK FOR SECURE BACKEND OPERATIONS
import { auth, db } from "@/lib/firebase.admin";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // .docx
];

/**
 * Helper function to safely extract raw text from a PDF buffer in a Node.js environment.
 * Includes a 30-second timeout to prevent malformed PDFs from hanging the server thread.
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
    setTimeout(() => reject(new Error("PDF parsing timeout exceeded (60s). The file might be corrupted or too complex.")), 60000)
  );

  return Promise.race([parsePromise, timeoutPromise]);
};

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
    let briefText = (formData.get("briefText") as string) || "";

    const sidesFile = formData.get("sidesFile") as File | null;
    const briefFile = formData.get("briefFile") as File | null;

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
        { error: "Only PDFs and Word documents (.docx) are allowed for the brief" },
        { status: 400 }
      );
    }
  }

    // Security Check: Ensure the requested userPath belongs to the authenticated user
    if (!userPath || !userPath.startsWith(`${authenticatedUserId}_`)) {
      console.error(` SECURITY ALERT: User ${authenticatedUserId} attempted to generate an audition for ${userPath}`);
      return NextResponse.json({ error: "Unauthorized access to this path." }, { status: 403 });
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

    // 4. FETCH THE ACTOR'S MASTER PROFILE (The Secret Sauce)
    console.log(`Fetching Master Profile for ${userPath}...`);
    const profileRef = db.doc(`users/${userPath}/profile/master`);
    const profileSnap = await profileRef.get();
    
    let actorDNAContext = "No DNA profile found. Provide high-level, generalized acting coaching based solely on the script.";
    
    if (profileSnap.exists) {
      const profileData = profileSnap.data();
      // Stringify the profile so the AI can read it as context
      actorDNAContext = JSON.stringify(profileData?.profile || {});
      console.log("✅ Master Profile successfully loaded and injected.");
    } else {
      console.log("⚠️ No Master Profile found. Proceeding with generic coaching.");
    }

    //special instruction based on project type
    let categoryInstruction = "";
    
    if (projectType === "commercial") {
        categoryInstruction = COMMERCIAL_MODE_PROMPT;
    } else if (projectType === "theater") {
        categoryInstruction = THEATHER_MODE_PROMPT;
    }
    


    // 5. INITIALIZE VERTEX AI FOR FIREBASE
    const { getAI, getGenerativeModel, VertexAIBackend } = await import("firebase/ai");
    const { getApp: getFirebaseApp } = await import("@/lib/firebase");

    const ai = getAI(getFirebaseApp(), { backend: new VertexAIBackend() });

    const model = getGenerativeModel(ai, { 
      model: "gemini-2.5-pro", 
      systemInstruction: { role: "user", parts: [{ text: AUDITION_COACH_PROMPT }] },
      generationConfig: { 
        responseMimeType: "application/json",
        temperature: 0.3,
        responseSchema: {
          type: "OBJECT",
          properties: {
            intro: { type: "STRING" },
            sections: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  items: { type: "ARRAY", items: { type: "STRING" } }
                },
                required: ["title", "items"]
              }
            },
            outro: { type: "STRING" }
          },
          required: ["intro", "sections", "outro"]
        } as any
      }
    });

    // 6. COMPILE PAYLOAD FOR AI
    const prompt = `
      You are coaching ${actorName}. 

      ${categoryInstruction}
      
      ACTOR'S DNA PROFILE (Use this psychological profile and physical tendencies to personalize the coaching):
      ${actorDNAContext}
      
      Here are the audition materials for analysis:

      CONTEXT:
      - Project Category: ${projectType.toUpperCase()}
      - Project: ${project || "Not specified"}
      
      CHARACTER BRIEF / DIRECTOR NOTES:
      ${briefText || "No brief provided. Infer context from the sides."}

      AUDITION SIDES (SCRIPT):
      ${sidesText || "No sides provided."}
    `;

    console.log("Initiating Vertex AI Synthesis Call for Audition...");

    // 7. EXECUTE AI INFERENCE AND PARSE RESPONSE
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let performanceMap;
    try {
        performanceMap = JSON.parse(responseText);
    } catch (parseError) {
        console.error("Failed to parse AI JSON output:", responseText);
        return NextResponse.json({ error: 'AI returned malformed data.' }, { status: 502 });
    }

    console.log("✅ BREAKDOWN GENERATED SUCCESSFULLY!");

    // 8. RETURN TO FRONTEND
    return NextResponse.json({
      success: true,
      message: "Performance Map generated successfully.",
      data: performanceMap,
    });

  } catch (error) {
    console.error("Error during Audition synthesis: ", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error during synthesis." },
      { status: 500 }
    );
  }
}