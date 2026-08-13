"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCcw, Download, Dna, Brain, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/lib/context/AuthContext";
import { getDb } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import HeroSummary from "@/components/dna-vault/HeroSummary";
import DnaVaultGrid, { DnaAttribute } from "@/components/dna-vault/DnaVaultGrid";

type DnaProfile = {
  attributes: DnaAttribute[];
  completion?: number;
  aiSummary?: string;
};

export default function DnaVaultPage() {
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<DnaProfile | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const firstName = (user.displayName || "").split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") || "Actor";
      const userPath = `${user.uid}_${firstName}`;

      const db = getDb();
      const vaultRef = doc(db, `users/${userPath}/dnaVault/master`);
      const vaultSnap = await getDoc(vaultRef);

      if (vaultSnap.exists()) {
        const data = vaultSnap.data() as any;
        setProfile({
          attributes: data.attributes || [],
          completion: typeof data.completion === "number" ? data.completion : 0,
          aiSummary: data.aiSummary || undefined,
        });
      } else {
        const profileRef = doc(db, `users/${userPath}/profile/master`);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const d = profileSnap.data() as any;
          setProfile({ 
            attributes: d.dnaAttributes || [], 
            completion: d.dnaCompletion || 0, 
            aiSummary: d.aiSummary 
          });
        } else {
          setProfile({ attributes: [], completion: 0 });
        }
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [user, authLoading]);

  return (
    <main className="flex flex-1 flex-col min-h-screen bg-background text-foreground transition-colors pb-16">
      <DashboardHeader title="Personal DNA Vault" />

      <div className="px-4 sm:px-8 py-6 max-w-6xl mx-auto w-full space-y-8">
        
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
          </div>
        )}

      </div>
    </main>
  );
}