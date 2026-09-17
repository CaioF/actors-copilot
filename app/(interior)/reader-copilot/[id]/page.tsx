"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { logger } from "@/lib/logger";
import { Loader2, ArrowLeft } from "lucide-react";
import { ActorCopilotRehearsal } from "@/components/actor-copilot/actor-copilot-rehearsal";
import type { SceneData } from "@/lib/actor-copilot/script-parser";

interface AuditionDocData {
  project: string;
  role: string;
  sidesText?: string;
}

export default function ActorCopilotAuditionView() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <ActorCopilotAuditionContent />
    </Suspense>
  );
}

function ActorCopilotAuditionContent() {
  const params = useParams();
  const router = useRouter();
  const auditionId = params.id as string;

  const [auditionData, setAuditionData] = useState<AuditionDocData | null>(null);
  const [parsedScene, setParsedScene] = useState<SceneData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && auditionId) {
        const firstName = user.displayName
          ? user.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "")
          : "Actor";
        const userPath = `${user.uid}_${firstName}`;

        await loadAuditionAndParse(user, userPath, auditionId);
      } else {
        setError("User not authenticated or invalid audition ID.");
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auditionId]);

  const loadAuditionAndParse = async (user: any, userPath: string, id: string) => {
    try {
      const db = getDb();
      const docRef = doc(db, `users/${userPath}/auditions/${id}`);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setError("Audition document not found.");
        setIsLoading(false);
        return;
      }

      const data = docSnap.data() as AuditionDocData;
      setAuditionData(data);

      if (!data.sidesText || !data.sidesText.trim()) {
        setError("No script sides text found in this audition.");
        setIsLoading(false);
        return;
      }

      // Parse sides text via API
      const idToken = await user.getIdToken();
      const response = await fetch("/api/actor-copilot/parse-script", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          auditionId: id,
          userPath,
          sidesText: data.sidesText,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Failed to parse audition script.");
      }

      const resData = await response.json();
      if (resData.scene) {
        setParsedScene(resData.scene);
      }
    } catch (err: any) {
      logger.error({ err, msg: "Error loading audition for rehearsal" });
      setError(err.message || "Failed to load audition for rehearsal.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="font-title text-lg text-foreground animate-pulse">Preparing rehearsal scene...</p>
      </div>
    );
  }

  if (error || !parsedScene) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-6">
        <h2 className="text-2xl font-title text-foreground mb-3">Rehearsal Unavailable</h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-md text-center">
          {error || "Could not load script data for this audition."}
        </p>
        <button
          onClick={() => router.push("/auditions")}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft size={16} /> Return to Auditions
        </button>
      </div>
    );
  }

  return (
    <main className="flex flex-1 flex-col h-full bg-background">
      <ActorCopilotRehearsal
        scene={parsedScene}
        auditionId={auditionId}
        projectTitle={auditionData?.project}
        initialActorCharacter={auditionData?.role ? auditionData.role.toUpperCase() : undefined}
        onExit={() => router.push(`/auditions/${auditionId}`)}
      />
    </main>
  );
}
