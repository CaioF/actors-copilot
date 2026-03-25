import { NextResponse } from "next/server";
import PDFParser from "pdf2json";
import { AUDITION_COACH_PROMPT, COMMERCIAL_MODE_PROMPT, } from "@/lib/chat-types";
// IMPORT THE ADMIN SDK FOR SECURE BACKEND OPERATIONS
import { auth, db } from "@/lib/firebase.admin";

/**
 * Helper function to safely extract raw text from a PDF buffer in a Node.js environment.
 */
const extractTextFromPDF = (buffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
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
    const project = formData.get("project") as string;
    const role = formData.get("role") as string;
    const deadline = formData.get("deadline") as string;
    
    // Extract routing and personalization parameters
    const userPath = formData.get("userPath") as string;
    const actorName = formData.get("actorName") as string || "Actor";

    let sidesText = (formData.get("sidesText") as string) || "";
    let briefText = (formData.get("briefText") as string) || "";

    const sidesFile = formData.get("sidesFile") as File | null;
    const briefFile = formData.get("briefFile") as File | null;

    // Security Check: Ensure the requested userPath belongs to the authenticated user
    if (!userPath || !userPath.startsWith(`${authenticatedUserId}_`)) {
      console.error(`🚨 SECURITY ALERT: User ${authenticatedUserId} attempted to generate an audition for ${userPath}`);
      return NextResponse.json({ error: "Unauthorized access to this path." }, { status: 403 });
    }

    // 3. PARSE PDFS SAFELY
    if (sidesFile && sidesFile.type === "application/pdf") {
      const arrayBuffer = await sidesFile.arrayBuffer();
      sidesText = await extractTextFromPDF(Buffer.from(arrayBuffer));
    }

    if (briefFile && briefFile.type === "application/pdf") {
      const arrayBuffer = await briefFile.arrayBuffer();
      briefText = await extractTextFromPDF(Buffer.from(arrayBuffer));
    }

    // 4. FETCH THE ACTOR'S MASTER PROFILE (The Secret Sauce)
    console.log(`Fetching Master Profile for ${userPath}...`);
    const profileRef = db.doc(`users/${userPath}/masterProfile/current`);
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
        // We instruct the AI to change its language for commercials
        categoryInstruction = COMMERCIAL_MODE_PROMPT;
    } else {
      categoryInstruction = ""; // For cinematic, we can use the default prompt which is more in-depth and nuanced
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