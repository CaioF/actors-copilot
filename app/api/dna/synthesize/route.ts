import { NextResponse } from 'next/server';
import { SYNTHESIZER_PROMPT } from '@/lib/chat-types'; 
// IMPORTAÇÃO NOVA: Usando o Admin SDK super-poderoso que você configurou
import { auth, db } from "@/lib/firebase.admin"; 

export async function POST(request: Request) {
    try {
        // security check - verify token and extract user ID
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
        }

        const token = authHeader.substring(7);
        const decodedToken = await auth.verifyIdToken(token);
        const authenticatedUserId = decodedToken.uid;

        // get payload
        const body = await request.json();
        const { userPath } = body;

        // Regra de Ouro: O userPath SOLICITADO precisa começar com o UID de quem está LOGADO
        if (!userPath || !userPath.startsWith(`${authenticatedUserId}_`)) {
            console.error(`🚨 ALERTA DE SEGURANÇA: Usuário ${authenticatedUserId} tentou acessar a pasta ${userPath}`);
            return NextResponse.json({ error: "Unauthorized access to this path." }, { status: 403 });
        }

        // database search
        const profileRef = db.doc(`users/${userPath}/masterProfile/current`);
        const profileSnap = await profileRef.get();

        let existingProfileTime = 0;
        if (profileSnap.exists) {
            const profileData = profileSnap.data();
            existingProfileTime = new Date(profileData?.lastUpdated).getTime();
        }

        const vaultRef = db.collection(`users/${userPath}/dnaVault`).orderBy('timestamp', 'asc');
        const vaultSnapshot = await vaultRef.get();

        if (vaultSnapshot.empty) {
            return NextResponse.json({ error: 'No DNA extractions found. Complete a session first.' }, { status: 400 });
        }

        // ============================================================================
        // 3. SMART CACHE CHECK
        // ============================================================================
        const latestExtractionDoc = vaultSnapshot.docs[vaultSnapshot.docs.length - 1].data();
        const latestExtractionTime = latestExtractionDoc.timestamp?.toDate()?.getTime() || 0;

        if (profileSnap.exists && latestExtractionTime <= existingProfileTime) {
            console.log(`⚡ CACHE HIT: No new DNA found for ${userPath}. Returning existing Master Profile.`);
            return NextResponse.json({ 
                success: true, 
                message: 'Returned cached profile.',
                data: profileSnap.data(),
                cached: true 
            }, { status: 200 });
        }

        // AI generating (if new dna)
        console.log(`🔄 NEW DNA DETECTED for ${userPath}. Initiating Vertex AI Synthesis...`);

        const compiledRawData = vaultSnapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
                section: data.section,
                date: data.timestamp?.toDate()?.toISOString() || new Date().toISOString(),
                extractions: data.extractions
            };
        });

        const { getAI, getGenerativeModel, VertexAIBackend } = await import("firebase/ai");
        const { getApp: getFirebaseApp } = await import("@/lib/firebase");

        const ai = getAI(getFirebaseApp(), { backend: new VertexAIBackend() });
        const model = getGenerativeModel(ai, { 
            model: "gemini-2.5-flash",
            systemInstruction: { role: "user", parts: [{ text: SYNTHESIZER_PROMPT }] },
            generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.3
            }
        });

        const prompt = `Here is the actor's raw DNA Vault data. Synthesize it exactly as instructed:\n\n${JSON.stringify(compiledRawData, null, 2)}`;
        
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        let masterProfile;
        try {
            masterProfile = JSON.parse(responseText);
        } catch (parseError) {
            console.error("Failed to parse AI JSON output:", responseText);
            return NextResponse.json({ error: 'AI returned malformed data.' }, { status: 502 });
        }

        // save
        const profilePayload = {
            status: "synthesis_complete",
            lastUpdated: new Date().toISOString(),
            dataPointsAnalyzed: compiledRawData.length,
            profile: masterProfile 
        };

        //  .set() insted of setDoc()
        await profileRef.set(profilePayload, { merge: true });

        console.log(`✅ DATA SAVED SUCCESSFULLY IN FIRESTORE FOR ${userPath}!`);

        return NextResponse.json({ 
            success: true, 
            message: 'Synthesis completed successfully.',
            data: profilePayload,
            cached: false
        }, { status: 200 });

    } catch (error) {
        console.error("Error during DNA synthesis: ", error);
        return NextResponse.json({ error: 'Internal Server Error during synthesis.' }, { status: 500 });
    }
}