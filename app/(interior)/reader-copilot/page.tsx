"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { logger } from "@/lib/logger";
import {
  Clapperboard,
  Upload,
  FileText,
  Play,
  Loader2,
  Sparkles,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { ActorCopilotRehearsal } from "@/components/actor-copilot/actor-copilot-rehearsal";
import type { SceneData } from "@/lib/actor-copilot/script-parser";

interface AuditionSummary {
  id: string;
  project: string;
  role: string;
  sidesText?: string;
  createdAt?: any;
}

export default function ActorCopilotMainPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [auditions, setAuditions] = useState<AuditionSummary[]>([]);
  const [isLoadingAuditions, setIsLoadingAuditions] = useState(true);

  // Upload / Custom Script state
  const [sidesText, setSidesText] = useState("");
  const [selectedAuditionId, setSelectedAuditionId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedScene, setParsedScene] = useState<SceneData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const firstName = user.displayName
          ? user.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "")
          : "Actor";
        const userPath = `${user.uid}_${firstName}`;
        await fetchUserAuditions(userPath);
      } else {
        setIsLoadingAuditions(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchUserAuditions = async (userPath: string) => {
    try {
      const db = getDb();
      const q = query(
        collection(db, `users/${userPath}/auditions`),
        orderBy("createdAt", "desc"),
        limit(15)
      );
      const querySnap = await getDocs(q);
      const list: AuditionSummary[] = [];

      querySnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.sidesText && data.sidesText.trim()) {
          list.push({
            id: docSnap.id,
            project: data.project || "Untitled Project",
            role: data.role || "Character",
            sidesText: data.sidesText,
            createdAt: data.createdAt,
          });
        }
      });

      setAuditions(list);
    } catch (err) {
      logger.error({ err, msg: "Failed to fetch user auditions for rehearsal launcher" });
    } finally {
      setIsLoadingAuditions(false);
    }
  };

  const handleStartRehearsal = async (customText?: string, auditionId?: string) => {
    const textToParse = customText || sidesText;
    if (!textToParse.trim() && !auditionId) return;

    setIsParsing(true);
    setErrorMessage(null);

    try {
      const idToken = await currentUser?.getIdToken();
      if (!idToken) throw new Error("Authentication token missing.");

      const firstName = currentUser?.displayName
        ? currentUser.displayName.split(" ")[0].replace(/[^a-zA-Z0-9]/g, "")
        : "Actor";
      const userPath = `${currentUser?.uid}_${firstName}`;

      const response = await fetch("/api/actor-copilot/parse-script", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sidesText: textToParse,
          auditionId,
          userPath,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to parse script");
      }

      const data = await response.json();
      if (data.scene) {
        setParsedScene(data.scene);
      }
    } catch (err: any) {
      logger.error({ err, msg: "Script parsing failed" });
      setErrorMessage(err.message || "Failed to process script for rehearsal.");
    } finally {
      setIsParsing(false);
    }
  };

  if (parsedScene) {
    return (
      <main className="flex flex-1 flex-col h-full bg-background">
        <ActorCopilotRehearsal
          scene={parsedScene}
          auditionId={selectedAuditionId || undefined}
          onExit={() => setParsedScene(null)}
        />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col h-full bg-background text-foreground">
      <DashboardHeader title="Reader Copilot" />

      <div className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-5xl mx-auto w-full">
        {/* HERO BANNER */}
        <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-8 mb-8 shadow-sm">
          <div className="flex items-center gap-3 text-primary mb-3">
            <Clapperboard className="w-8 h-8" />
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-primary/10">
              Interactive Scene Partner
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-foreground">
            Rehearse Your Scene Live with AI
          </h1>
          <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
            Upload or select your audition script, choose your character, and perform your lines naturally.
            The AI acts out the other characters with expressive voice delivery.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            {errorMessage}
          </div>
        )}

        {/* SECTION 1: CHOOSE FROM EXISTING AUDITIONS */}
        {auditions.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Rehearse an Uploaded Audition
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {auditions.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedAuditionId(item.id);
                    void handleStartRehearsal(item.sidesText, item.id);
                  }}
                  className="p-5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors truncate">
                      {item.project}
                    </h3>
                    <p className="text-xs font-medium text-muted-foreground mb-3">
                      Role: <span className="text-foreground">{item.role}</span>
                    </p>
                    <p className="text-xs text-muted-foreground/80 line-clamp-2 italic font-serif">
                      "{item.sidesText}"
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-primary">
                    <span>Start Scene</span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 2: PASTE OR UPLOAD NEW SCRIPT */}
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <h2 className="text-xl font-bold mb-2 text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Paste a New Script / Scene Text
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Paste raw dialogue text directly to start a instant rehearsal session.
          </p>

          <textarea
            value={sidesText}
            onChange={(e) => setSidesText(e.target.value)}
            rows={8}
            placeholder={`SARAH\nWhere were you?\n\nJOHN\nI told you I was working.\n\nSARAH\nYou always say that.`}
            className="w-full rounded-2xl border border-border bg-background p-4 text-sm font-serif leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4 resize-y"
          />

          <div className="flex justify-end">
            <button
              onClick={() => handleStartRehearsal()}
              disabled={!sidesText.trim() || isParsing}
              className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
            >
              {isParsing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Parsing Scene...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>Start Interactive Rehearsal</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
