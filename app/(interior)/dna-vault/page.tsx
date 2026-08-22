"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCcw, Download, Dna, Quote, History } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { getDb } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import HeroSummary from "@/components/dna-vault/HeroSummary";
import DnaVaultGrid, { DnaAttribute } from "@/components/dna-vault/DnaVaultGrid";
import { parseDnaProfileData } from "@/lib/dna/dna-parser";

type DnaProfileState = {
  attributes: DnaAttribute[];
  completion: number;
  aiSummary: string;
  analysisTimeline: Array<{ inference: string; section?: string; timestamp?: string }>;
  leafSnippets: Array<{ quote: string; section?: string; timestamp?: string }>;
};

export default function DnaVaultPage() {
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<DnaProfileState | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const firstName = (user.displayName || "").split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") || "Actor";
      const possibleUserPaths = [
        `${user.uid}_${firstName}`,
        `${user.uid}_Actor`,
        user.uid,
      ];

      const db = getDb();
      let masterData: any = null;
      let vaultSubcollectionDocs: any[] = [];

      // Try candidates for profile/master
      for (const path of possibleUserPaths) {
        const profileRef = doc(db, `users/${path}/profile/master`);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          masterData = profileSnap.data();

          // Try subcollection dnaVault for this user path
          try {
            const subcollRef = collection(db, `users/${path}/dnaVault`);
            const subcollSnap = await getDocs(subcollRef);
            if (!subcollSnap.empty) {
              vaultSubcollectionDocs = subcollSnap.docs.map((d) => d.data());
            }
          } catch (subErr) {
            console.warn("Could not read dnaVault subcollection:", subErr);
          }

          break;
        }

        // Also check if dnaVault/master document exists as legacy
        const masterVaultRef = doc(db, `users/${path}/dnaVault/master`);
        const masterVaultSnap = await getDoc(masterVaultRef);
        if (masterVaultSnap.exists()) {
          masterData = masterVaultSnap.data();
          break;
        }
      }

      const parsed = parseDnaProfileData(masterData || {}, vaultSubcollectionDocs);
      setProfile(parsed);
    } catch (err: any) {
      console.error("Error loading DNA Vault:", err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [user, authLoading]);

  return (
    <main className="flex flex-1 flex-col min-h-screen bg-background text-foreground transition-colors pb-8">
      <DashboardHeader title="Personal DNA Vault" />

      <div className="px-4 sm:px-8 py-6 max-w-6xl mx-auto w-full space-y-8 flex-1">
        {/* Page Title & Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border">
          <div>
            <h1 className="font-title text-3xl sm:text-4xl font-bold text-foreground">
              Personal DNA <span className="text-primary">Vault</span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              A living, navigable map of your extracted psychological traits and personal reservoirs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={fetchData}
              disabled={loading}
              className="py-2.5 px-4 rounded-full border border-border bg-card hover:bg-muted text-foreground font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCcw className={`h-3.5 w-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            <Link
              href="/chat"
              className="py-2.5 px-5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-sm"
            >
              <Sparkles className="h-4 w-4" />
              <span>Extract More DNA</span>
            </Link>

            <button
              onClick={() => window.print()}
              className="py-2.5 px-4 rounded-full border border-border bg-card hover:bg-muted text-foreground font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Content Section */}
        {loading || authLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-3xl bg-card" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-64 rounded-3xl bg-card" />
              <Skeleton className="h-64 rounded-3xl bg-card" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center space-y-3">
            <h3 className="font-title font-bold text-lg text-foreground">Error loading DNA Vault</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">{error}</p>
            <button
              onClick={fetchData}
              className="py-2 px-4 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
            >
              Try Again
            </button>
          </div>
        ) : profile && profile.attributes.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-12 text-center space-y-4 max-w-xl mx-auto my-8">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Dna className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-title font-bold text-xl text-foreground">No DNA Extracted Yet</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Start a session with your AI Copilot to extract your psychological reservoirs, core values, and communication styles.
              </p>
            </div>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 py-3 px-6 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm"
            >
              <Sparkles className="h-4 w-4" />
              Start First Extraction Session
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Top Overview & Progress Card */}
            <HeroSummary
              completion={profile?.completion || 0}
              totalAttributes={profile?.attributes.length || 0}
              aiSummary={profile?.aiSummary}
            />

            {/* Categorized Attributes Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-title font-bold text-xl text-foreground">
                  Extracted Reservoirs
                </h3>
                <span className="text-xs text-muted-foreground font-medium">
                  {profile?.attributes.length} Total Traits
                </span>
              </div>

              <DnaVaultGrid attributes={profile?.attributes || []} />
            </div>

            {/* AI Insights Timeline & Memory Quotes */}
            {((profile?.analysisTimeline && profile.analysisTimeline.length > 0) ||
              (profile?.leafSnippets && profile.leafSnippets.length > 0)) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                {/* Profiler Inferences */}
                {profile.analysisTimeline && profile.analysisTimeline.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <History className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-title font-bold text-base text-foreground">
                          AI Profiler Insights Timeline
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Key psychological deductions made by your AI Copilot
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3 pt-1">
                      {profile.analysisTimeline.map((item, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl border border-border/70 bg-muted/30 text-xs sm:text-sm space-y-1">
                          <p className="text-foreground leading-relaxed font-medium">{item.inference}</p>
                          {item.section && (
                            <span className="inline-block text-[10px] uppercase tracking-wider font-semibold text-primary/80">
                              Section: {item.section}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recorded Quotes / Leaf Snippets */}
                {profile.leafSnippets && profile.leafSnippets.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Quote className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-title font-bold text-base text-foreground">
                          Key Memory Quotes
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Verbatim actor statements captured during extraction
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3 pt-1">
                      {profile.leafSnippets.map((item, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl border border-border/70 bg-muted/30 text-xs sm:text-sm space-y-1">
                          <p className="text-foreground leading-relaxed italic">"{item.quote}"</p>
                          {item.section && (
                            <span className="inline-block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                              {item.section}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}