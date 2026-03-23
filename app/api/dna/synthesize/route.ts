import { NextResponse } from 'next/server';
import { SYNTHESIZER_PROMPT } from '@/lib/chat-types'; 
import { getDb } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  setDoc
} from "firebase/firestore";

export async function POST(request: Request) {
    try {
        // 1. Forçando o usuário de teste
        const userId = "demo-user"; 
        const db = getDb();

        // 2. Fetch DNA Vault (Usando 100% Client SDK agora)
        const vaultRef = collection(db, `users/${userId}/dnaVault`);
        const vaultQuery = query(vaultRef, orderBy('timestamp', 'asc'));
        const vaultSnapshot = await getDocs(vaultQuery);

        if (vaultSnapshot.empty) {
            return NextResponse.json({ error: 'No DNA extractions found. Complete a session first.' }, { status: 400 });
        }

        // 3. Compile Payload
        const compiledRawData = vaultSnapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
                section: data.section,
                date: data.timestamp?.toDate()?.toISOString() || new Date().toISOString(),
                extractions: data.extractions
            };
        });

        // 4. INICIALIZAÇÃO DA IA (Exatamente o seu bloco)
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

        // 5. Execute AI
        const prompt = `Here is the actor's raw DNA Vault data. Synthesize it exactly as instructed:\n\n${JSON.stringify(compiledRawData, null, 2)}`;
        
        console.log("Initiating Firebase AI Synthesis Call...");
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        let masterProfile;
        try {
            masterProfile = JSON.parse(responseText);
        } catch (parseError) {
            console.error("Failed to parse AI JSON output:", responseText);
            return NextResponse.json({ error: 'AI returned malformed data.' }, { status: 502 });
        }

        // 6. Save Final Profile (Usando o setDoc do Client SDK)
        const profilePayload = {
            status: "synthesis_complete",
            lastUpdated: new Date().toISOString(),
            dataPointsAnalyzed: compiledRawData.length,
            profile: masterProfile 
        };

        const profileRef = doc(db, `users/${userId}/masterProfile/current`);
        await setDoc(profileRef, profilePayload, { merge: true });

        // PROVA REAL NO TERMINAL
        console.log("✅ DADO SALVO COM SUCESSO NO FIRESTORE! Aqui está a prova:");
        console.dir(profilePayload.profile, { depth: null, colors: true });

        return NextResponse.json({ 
            success: true, 
            message: 'Synthesis completed successfully.',
            data: profilePayload 
        }, { status: 200 });

    } catch (error) {
        console.error("Error during DNA synthesis: ", error);
        return NextResponse.json({ error: 'Internal Server Error during synthesis.' }, { status: 500 });
    }
}