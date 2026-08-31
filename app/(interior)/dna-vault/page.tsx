"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  RefreshCcw,
  Download,
  Dna,
  Quote,
  History,
  Brain,
  Search,
  MessageSquare,
  ChevronRight,
  Filter,
} from "lucide-react";
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
  totalChatSeconds: number;
};

type VaultTab = "overview" | "insights" | "memory";

export default function DnaVaultPage() {
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<DnaProfileState | null>(null);
  const [activeTab, setActiveTab] = useState<VaultTab>("overview");

  // Search & Filter state for Insights & Memory tabs
  const [insightsQuery, setInsightsQuery] = useState("");
  const [selectedInsightsSection, setSelectedInsightsSection] = useState<string>("ALL");

  const [memoryQuery, setMemoryQuery] = useState("");
  const [selectedMemorySection, setSelectedMemorySection] = useState<string>("ALL");

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const firstName =
        (user.displayName || "").split(" ")[0].replace(/[^a-zA-Z0-9]/g, "") || "Actor";
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

  // Unique sections for Insights filter
  const insightsSections = useMemo(() => {
    if (!profile?.analysisTimeline) return [];
    const sections = new Set<string>();
    profile.analysisTimeline.forEach((item) => {
      if (item.section) sections.add(item.section);
    });
    return Array.from(sections);
  }, [profile?.analysisTimeline]);

  // Filtered Insights
  const filteredInsights = useMemo(() => {
    if (!profile?.analysisTimeline) return [];
    return profile.analysisTimeline.filter((item) => {
      const matchesSection =
        selectedInsightsSection === "ALL" || item.section === selectedInsightsSection;
      const matchesQuery =
        !insightsQuery.trim() ||
        item.inference.toLowerCase().includes(insightsQuery.toLowerCase().trim()) ||
        (item.section && item.section.toLowerCase().includes(insightsQuery.toLowerCase().trim()));
      return matchesSection && matchesQuery;
    });
  }, [profile?.analysisTimeline, selectedInsightsSection, insightsQuery]);

  // Unique sections for Memory Quotes filter
  const memorySections = useMemo(() => {
    if (!profile?.leafSnippets) return [];
    const sections = new Set<string>();
    profile.leafSnippets.forEach((item) => {
      if (item.section) sections.add(item.section);
    });
    return Array.from(sections);
  }, [profile?.leafSnippets]);

  // Filtered Memory Quotes
  const filteredMemoryQuotes = useMemo(() => {
    if (!profile?.leafSnippets) return [];
    return profile.leafSnippets.filter((item) => {
      const matchesSection =
        selectedMemorySection === "ALL" || item.section === selectedMemorySection;
      const matchesQuery =
        !memoryQuery.trim() ||
        item.quote.toLowerCase().includes(memoryQuery.toLowerCase().trim()) ||
        (item.section && item.section.toLowerCase().includes(memoryQuery.toLowerCase().trim()));
      return matchesSection && matchesQuery;
    });
  }, [profile?.leafSnippets, selectedMemorySection, memoryQuery]);

  return (
    <main className="flex flex-1 flex-col min-h-screen bg-background text-foreground transition-colors pb-8">
      <DashboardHeader title="Personal DNA Vault" />

      <div className="px-4 sm:px-8 py-6 max-w-6xl mx-auto w-full space-y-6 flex-1">
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
            <Skeleton className="h-12 w-96 rounded-full bg-card" />
            <Skeleton className="h-56 w-full rounded-3xl bg-card" />
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
          <div className="space-y-6">
            {/* Segmented Control / Tab Navigation */}
            <div className="flex items-center gap-2 p-1.5 rounded-full bg-card border border-border/80 shadow-sm overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={`py-2.5 px-5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 shrink-0 flex items-center gap-2 ${
                  activeTab === "overview"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Brain className="h-4 w-4" />
                <span>Overview &amp; Core Traits</span>
                <span className="ml-1 text-[11px] opacity-80 px-1.5 py-0.5 rounded-full bg-primary-foreground/20">
                  {profile?.attributes.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("insights")}
                className={`py-2.5 px-5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 shrink-0 flex items-center gap-2 ${
                  activeTab === "insights"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <History className="h-4 w-4" />
                <span>Profiler Insights</span>
                <span className="ml-1 text-[11px] opacity-80 px-1.5 py-0.5 rounded-full bg-primary-foreground/20">
                  {profile?.analysisTimeline.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("memory")}
                className={`py-2.5 px-5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 shrink-0 flex items-center gap-2 ${
                  activeTab === "memory"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Quote className="h-4 w-4" />
                <span>Verbatim Memory Bank</span>
                <span className="ml-1 text-[11px] opacity-80 px-1.5 py-0.5 rounded-full bg-primary-foreground/20">
                  {profile?.leafSnippets.length || 0}
                </span>
              </button>
            </div>

            {/* TAB 1: OVERVIEW & CORE TRAITS */}
            {activeTab === "overview" && (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* Top Executive Summary & Snapshot */}
                <HeroSummary
                  completion={profile?.completion || 0}
                  totalAttributes={profile?.attributes.length || 0}
                  aiSummary={profile?.aiSummary}
                  attributes={profile?.attributes}
                  totalChatSeconds={profile?.totalChatSeconds || 0}
                />

                {/* Extracted Reservoirs Grid */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-title font-bold text-xl text-foreground">
                      Extracted Reservoirs
                    </h3>
                    <span className="text-xs text-muted-foreground font-medium">
                      {profile?.attributes.length} Total Traits Map
                    </span>
                  </div>

                  <DnaVaultGrid attributes={profile?.attributes || []} />
                </div>
              </div>
            )}

            {/* TAB 2: PROFILER INSIGHTS TIMELINE */}
            {activeTab === "insights" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Insights Header & Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <History className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-title font-bold text-lg text-foreground">
                        AI Profiler Deductions Timeline
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Chronological psychological conclusions extracted by your AI Copilot
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    {/* Section Filter Pills */}
                    {insightsSections.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                        <button
                          type="button"
                          onClick={() => setSelectedInsightsSection("ALL")}
                          className={`py-1.5 px-3 rounded-full text-xs font-semibold transition-all shrink-0 ${
                            selectedInsightsSection === "ALL"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          All Sections
                        </button>
                        {insightsSections.map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => setSelectedInsightsSection(sec)}
                            className={`py-1.5 px-3 rounded-full text-xs font-semibold transition-all shrink-0 uppercase text-[10px] tracking-wider ${
                              selectedInsightsSection === sec
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {sec}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Search Bar */}
                    <div className="relative w-full sm:w-60">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Filter deductions..."
                        value={insightsQuery}
                        onChange={(e) => setInsightsQuery(e.target.value)}
                        className="w-full pl-9 pr-7 py-1.5 rounded-full text-xs bg-background border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                      />
                      {insightsQuery && (
                        <button
                          onClick={() => setInsightsQuery("")}
                          aria-label="Clear search"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline List Content */}
                {!profile?.analysisTimeline || profile.analysisTimeline.length === 0 ? (
                  <div className="rounded-3xl border border-border bg-card p-12 text-center space-y-3">
                    <History className="h-8 w-8 text-muted-foreground mx-auto opacity-60" />
                    <h4 className="font-title font-bold text-base text-foreground">No Profiler Deductions Yet</h4>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Engage in deeper chat sessions to allow the AI to infer behavioral patterns and emotional drivers.
                    </p>
                  </div>
                ) : filteredInsights.length === 0 ? (
                  <div className="rounded-3xl border border-border bg-card p-8 text-center space-y-2">
                    <p className="text-sm font-semibold text-foreground">No deductions match your search filter</p>
                    <button
                      onClick={() => {
                        setInsightsQuery("");
                        setSelectedInsightsSection("ALL");
                      }}
                      className="text-xs text-primary underline font-semibold"
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/70">
                    {filteredInsights.map((item, idx) => (
                      <div key={idx} className="relative group">
                        {/* Timeline Node Bullet */}
                        <div className="absolute -left-6 top-1.5 h-5 w-5 rounded-full border-2 border-primary bg-background flex items-center justify-center group-hover:bg-primary transition-colors">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary group-hover:bg-primary-foreground transition-colors" />
                        </div>

                        <div className="p-5 rounded-2xl border border-border/80 bg-card hover:border-primary/40 transition-all shadow-sm space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            {item.section && (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-primary/10 text-primary">
                                Section: {item.section}
                              </span>
                            )}
                            {item.timestamp && (
                              <span className="text-[11px] text-muted-foreground">
                                {item.timestamp}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground leading-relaxed font-medium">
                            {item.inference}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: VERBATIM MEMORY BANK */}
            {activeTab === "memory" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Memory Header & Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Quote className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-title font-bold text-lg text-foreground">
                        Verbatim Actor Memory Bank
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Exact statements and emotional quotes recorded during sessions
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    {/* Section Filter Pills */}
                    {memorySections.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                        <button
                          type="button"
                          onClick={() => setSelectedMemorySection("ALL")}
                          className={`py-1.5 px-3 rounded-full text-xs font-semibold transition-all shrink-0 ${
                            selectedMemorySection === "ALL"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          All Sections
                        </button>
                        {memorySections.map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => setSelectedMemorySection(sec)}
                            className={`py-1.5 px-3 rounded-full text-xs font-semibold transition-all shrink-0 uppercase text-[10px] tracking-wider ${
                              selectedMemorySection === sec
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {sec}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Search Bar */}
                    <div className="relative w-full sm:w-60">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search actor quotes..."
                        value={memoryQuery}
                        onChange={(e) => setMemoryQuery(e.target.value)}
                        className="w-full pl-9 pr-7 py-1.5 rounded-full text-xs bg-background border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                      />
                      {memoryQuery && (
                        <button
                          onClick={() => setMemoryQuery("")}
                          aria-label="Clear search"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Memory Quotes Content */}
                {!profile?.leafSnippets || profile.leafSnippets.length === 0 ? (
                  <div className="rounded-3xl border border-border bg-card p-12 text-center space-y-3">
                    <Quote className="h-8 w-8 text-muted-foreground mx-auto opacity-60" />
                    <h4 className="font-title font-bold text-base text-foreground">No Recorded Quotes Yet</h4>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Key quotes from your chat session extractions will appear here as memory building blocks.
                    </p>
                  </div>
                ) : filteredMemoryQuotes.length === 0 ? (
                  <div className="rounded-3xl border border-border bg-card p-8 text-center space-y-2">
                    <p className="text-sm font-semibold text-foreground">No memory quotes match your search filter</p>
                    <button
                      onClick={() => {
                        setMemoryQuery("");
                        setSelectedMemorySection("ALL");
                      }}
                      className="text-xs text-primary underline font-semibold"
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredMemoryQuotes.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-5 rounded-2xl border border-border/80 bg-card hover:border-primary/40 transition-all shadow-sm flex flex-col justify-between gap-4 group"
                      >
                        <div className="space-y-3">
                          <Quote className="h-5 w-5 text-primary/40 group-hover:text-primary transition-colors" />
                          <p className="text-sm text-foreground italic leading-relaxed font-serif">
                            "{item.quote}"
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          {item.section ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-muted text-muted-foreground">
                              {item.section}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                              Direct Snippet
                            </span>
                          )}

                          {item.timestamp && (
                            <span className="text-[11px] text-muted-foreground">
                              {item.timestamp}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
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