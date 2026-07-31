"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Target, Eye, User, Heart, Key, Shield, MessageCircle, Video, Dna, Flame, Info, Users, Clock, Split, Hourglass, Brain, Lock, MapPin, AlertTriangle, RefreshCcw } from "lucide-react";
import React from "react";
import type { CriticalBriefFact } from "@/lib/audition-types";

interface Section {
  title: string;
  items: string[];
}

interface StepResultProps {
  data: {
    intro?: string;
    sections: Section[];
    outro?: string;
    criticalBriefFacts?: CriticalBriefFact[];
  };
  onCoachClick?: () => void;
  onRegenerateClick?: () => void;
}

/**
 * StepResultSides Component
 * Displays the complete AI-generated audition breakdown with interactive sidebar navigation.
 * Built with theme-aware semantic CSS tokens for light and dark modes.
 */
export function StepResultSides({ data, onCoachClick, onRegenerateClick }: StepResultProps) {
  const [activeSection, setActiveSection] = useState("section-objective");
  
  // Backward Compatibility & Conditional Hydration
  const hasFullSections = data?.sections && data.sections.length >= 20;
  
  // Check if we have the 21st section AND if it contains actual content (not the N/A fallback)
  const hasInBetweenSection = data?.sections?.length >= 21;
  const showInBetween = hasInBetweenSection && !data.sections[13]?.items[0]?.includes("N/A");

  // Offset pointer for 21-section format vs legacy 20-section schema
  const offset = hasInBetweenSection ? 1 : 0;

  const s = data.sections;
  if (!data || !data.sections) return null;

  const renderMarkdown = (text: string) => (
    <div className="prose prose-neutral dark:prose-invert max-w-none prose-p:m-0 prose-p:inline prose-strong:font-semibold prose-strong:text-foreground">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ 
        behavior: "smooth", 
        block: "start" 
      });
      setActiveSection(id);
    }
  };

  const sidebarLinks = [
    { id: "section-objective", icon: Target, label: "Objective" },
    { id: "section-snapshot", icon: Eye, label: "Snapshot" },
    { id: "section-character", icon: User, label: "Character Breakdown" },
    { id: "section-relationships", icon: Users, label: "Relationship Dynamics" },
    { id: "section-palette", icon: Heart, label: "Emotional Palette" },
    { id: "section-beats", icon: Key, label: "Key Beats" },
    { id: "section-tactics", icon: Shield, label: "Tactics & Obstacles" },
    { id: "section-why-now", icon: Clock, label: "The Stakes" },
    { id: "section-moment", icon: Hourglass, label: "The Moment" },
    ...(showInBetween ? [{ id: "section-in-between", icon: Split, label: "The In-Between" }] : []),
    { id: "section-monologue", icon: Brain, label: "Inner Monologue" },
    { id: "section-secret", icon: Lock, label: "The Secret" },
    { id: "section-physical", icon: MapPin, label: "Physicality & Setting" },
    { id: "section-notes", icon: MessageCircle, label: "Coach Notes" },
    { id: "section-tape", icon: Video, label: "Self-Tape Plan" },
    { id: "section-bold-choice", icon: Flame, label: "The Bold Choice" },
    { id: "section-dna", icon: Dna, label: "Personal DNA" },
  ];

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-start mt-6 pb-12 font-sans relative">
      
      {/* LEFT COLUMN: MAIN CONTENT */}
      <div className="space-y-6">

        {/* Top Instructional Notice Banner */}
        <div className="flex items-center gap-3 px-5 py-4 bg-card border border-border rounded-2xl shadow-sm text-xs sm:text-sm text-muted-foreground font-medium">
          <Info size={18} className="text-primary shrink-0" />
          <span>Read the generated breakdown. If you don't like it or want another approach, feel free to push Alternative Take above.</span>
        </div>

        {/* CRITICAL BRIEF FACTS */}
        {data.criticalBriefFacts && data.criticalBriefFacts.length > 0 && (
          <section
            id="section-critical-brief-facts"
            role="region"
            aria-labelledby="critical-brief-facts-heading"
            className="rounded-2xl bg-primary/10 border-2 border-primary shadow-sm p-6 sm:p-8 scroll-mt-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-primary" size={24} aria-hidden="true" />
              <h3 id="critical-brief-facts-heading" className="text-xl font-bold text-foreground">
                Critical Facts from the Casting Brief
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Director- or casting-supplied facts that are non-negotiable for this audition. Honor these even when the sides do not mention them.
            </p>
            <ul className="space-y-3">
              {data.criticalBriefFacts.map((fact, i) => (
                <li
                  key={`${fact.label}-${i}`}
                  className="flex items-start gap-3 p-3 rounded-xl bg-card border border-primary/30 shadow-sm"
                >
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      fact.importance === "critical"
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/20 text-primary"
                    }`}
                  >
                    {fact.importance}
                  </span>
                  <div className="text-[15px] text-foreground">
                    <span className="font-semibold">{fact.label}:</span>{" "}
                    <span>{fact.value}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Intro Section */}
        {data.intro && (
          <div className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border-l-4 border-primary border-t border-r border-b border-border">
            <div className="prose prose-neutral dark:prose-invert max-w-none prose-p:text-base sm:prose-p:text-lg prose-p:italic prose-p:leading-relaxed text-foreground">
              <ReactMarkdown>{data.intro}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Fallback for Schema Mismatches */}
        {!hasFullSections && data.sections.map((section, idx) => (
           <div key={idx} className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border">
             <h3 className="text-xl font-bold text-foreground mb-4">{section.title}</h3>
             <div className="space-y-3">
               {section.items.map((item, i) => (
                 <React.Fragment key={i}>{renderMarkdown(item)}</React.Fragment>
               ))}
             </div>
           </div>
        ))}

        {hasFullSections && (
          <>
            {/* 1. Objective */}
            <div id="section-objective" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Target className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">Objective</h3>
              </div>
              <div className="text-foreground text-[15px] leading-relaxed">
                {s[0].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </div>

            {/* 2. Snapshot */}
            <div id="section-snapshot" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Eye className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">Snapshot</h3>
              </div>
              <div className="text-foreground text-[15px] leading-relaxed">
                {s[1].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </div>

            {/* 3, 4, 5. Character Breakdown */}
            <div id="section-character" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <User className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">Character Breakdown</h3>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-foreground mb-2 font-title tracking-tight text-base">Who they are</h4>
                  <div className="text-foreground text-[15px]">{s[2].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}</div>
                </div>
                <hr className="border-border" />
                <div>
                  <h4 className="font-bold text-foreground mb-2 font-title tracking-tight text-base">What they want</h4>
                  <div className="text-foreground text-[15px]">{s[3].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}</div>
                </div>
                <hr className="border-border" />
                <div>
                  <h4 className="font-bold text-foreground mb-2 font-title tracking-tight text-base">Contradictions</h4>
                  <div className="text-foreground text-[15px]">{s[4].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}</div>
                </div>
              </div>
            </div>

            {/* 6. Relationship Dynamics */}
            <div id="section-relationships" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Users className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">Relationship Dynamics</h3>
              </div>
              <div className="space-y-4 text-foreground text-[15px] leading-relaxed">
                {s[5].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </div>

            {/* 7. Emotional Palette */}
            <div id="section-palette" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Heart className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">Emotional Palette</h3>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {s[6].items.map((item, i) => (
                  <span key={i} className="px-4 py-1.5 rounded-full border border-border text-foreground text-xs sm:text-sm bg-muted/40 font-medium">
                    {item.replace(/^\s*[-*•]\s*/, '').trim()}
                  </span>
                ))}
              </div>
            </div>

            {/* 8. Key Beats / Turning Points */}
            <div id="section-beats" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Key className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">Key Beats / Turning Points</h3>
              </div>
              <div className="space-y-5">
                {s[7].items.map((item, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="w-7 h-7 mt-0.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-xs font-bold shadow-sm">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="text-foreground text-[15px] leading-relaxed">
                      {renderMarkdown(item.replace(/^Beat \d+: /, ''))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 9 & 10. Tactics & Obstacles */}
            <div id="section-tactics" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">Tactics & Obstacles</h3>
              </div>
              <div className="mb-6">
                <h4 className="font-bold text-foreground mb-3 font-title tracking-tight text-base">Tactics — how she pursues</h4>
                <ul className="space-y-3">
                  {s[8].items.map((item, i) => (
                    <li key={i} className="flex gap-3 items-start text-foreground text-[15px]">
                      <span className="text-primary mt-0.5 shrink-0 text-lg leading-none">•</span>
                      {renderMarkdown(item)}
                    </li>
                  ))}
                </ul>
              </div>
              <hr className="border-border my-6" />
              <div>
                <h4 className="font-bold text-foreground mb-3 font-title tracking-tight text-base">Obstacles — what blocks her</h4>
                <ul className="space-y-3">
                  {s[9].items.map((item, i) => (
                    <li key={i} className="flex gap-3 items-start text-foreground text-[15px]">
                      <span className="text-primary mt-0.5 shrink-0 text-lg leading-none">•</span>
                      {renderMarkdown(item)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 11. The Stakes */}
            <div id="section-why-now" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">The Stakes</h3>
              </div>
              <div className="space-y-4 text-foreground text-[15px] leading-relaxed">
                {s[10].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </div>

            {/* 12 & 13. The Moment */}
            <div id="section-moment" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Hourglass className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">The Moment</h3>
              </div>
              <div className="mb-6">
                <h4 className="font-bold text-foreground mb-3 font-title tracking-tight text-base">Moment Before</h4>
                <div className="text-foreground text-[15px]">
                  {s[11].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
                </div>
              </div>
              <hr className="border-border my-6" />
              <div>
                <h4 className="font-bold text-foreground mb-3 font-title tracking-tight text-base">Moment After</h4>
                <div className="text-foreground text-[15px]">
                  {s[12].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
                </div>
              </div>
            </div>

            {/* CONDITIONAL SECTION: The In-Between */}
            {showInBetween && (
              <div id="section-in-between" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
                <div className="flex items-center gap-3 mb-4">
                  <Split className="text-primary" size={24} />
                  <h3 className="text-xl font-bold text-foreground font-title">The In-Between</h3>
                </div>
                <div className="space-y-4 text-foreground text-[15px] leading-relaxed">
                  {s[13].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
                </div>
              </div>
            )}

            {/* 14. Inner Monologue */}
            <div id="section-monologue" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Brain className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">Inner Monologue</h3>
              </div>
              <ul className="space-y-3">
                {s[13+offset].items.map((item, i) => (
                  <li key={i} className="flex gap-3 items-start text-foreground text-[15px]">
                    <span className="text-primary mt-0.5 shrink-0 text-lg leading-none">•</span>
                    {renderMarkdown(item)}
                  </li>
                ))}
              </ul>
            </div>

            {/* 15. The Secret */}
            <div id="section-secret" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">The Secret</h3>
              </div>
              <div className="space-y-4 text-foreground text-[15px] leading-relaxed">
                {s[14+offset].items.map((item, i) => (
                  <div key={i} className="p-5 bg-primary/10 border border-primary/20 rounded-xl italic">
                    {renderMarkdown(item)}
                  </div>
                ))}
              </div>
            </div>

            {/* 16. Physicality & Setting */}
            <div id="section-physical" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">Physicality & Setting</h3>
              </div>
              <ul className="space-y-3">
                {s[15+offset].items.map((item, i) => (
                  <li key={i} className="flex gap-3 items-start text-foreground text-[15px]">
                    <span className="text-primary mt-0.5 shrink-0 text-lg leading-none">•</span>
                    {renderMarkdown(item)}
                  </li>
                ))}
              </ul>
            </div>

            {/* 17. Coach Notes */}
            <div id="section-notes" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <MessageCircle className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">Coach Notes</h3>
              </div>
              <div className="space-y-4 text-foreground text-[15px] leading-relaxed">
                {s[16+offset].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </div>

            {/* 18. Self-Tape Plan */}
            <div id="section-tape" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Video className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">Self-Tape Plan</h3>
              </div>
              <ul className="space-y-4">
                {s[17+offset].items.map((item, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <div
                      aria-hidden="true"
                      className="w-4 h-4 mt-1 border border-border rounded-[3px] shrink-0 bg-muted/50"
                    />
                    <div className="text-foreground text-[15px]">
                      {renderMarkdown(item)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* 19. The Bold Choice */}
            <div id="section-bold-choice" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Flame className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">The Bold Choice</h3>
              </div>
              <div className="space-y-4 text-foreground text-[15px] leading-relaxed">
                {s[18+offset].items.map((item, i) => (
                  <div key={i} className="p-5 bg-primary/10 border border-primary/20 rounded-xl">
                    {renderMarkdown(item)}
                  </div>
                ))}
              </div>
            </div>

            {/* 20. Personal DNA */}
            <div id="section-dna" className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 sm:p-8 border border-border scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Dna className="text-primary" size={24} />
                <h3 className="text-xl font-bold text-foreground font-title">Personal DNA Connection</h3>
              </div>
              <div>
                <h4 className="font-bold text-foreground mb-3 text-sm tracking-tight font-title">Suggested reservoirs to access for this role</h4>
                <div className="flex flex-wrap gap-2.5">
                  {s[19+offset].items.map((item, i) => {
                     const isShortTag = item.length < 30 && !item.includes(':');
                     if (isShortTag) {
                       return (
                         <span key={i} className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                           {item.replace(/^\s*[-*•]\s*/, '').trim()}
                         </span>
                       )
                     }
                     return <div key={i} className="w-full text-foreground text-[15px] mt-2">{renderMarkdown(item)}</div>
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Outro Text */}
        {data.outro && (
          <div className="rounded-2xl bg-transparent p-6 sm:p-8 text-muted-foreground text-center">
            <div className="prose prose-neutral dark:prose-invert max-w-none prose-p:italic prose-p:m-0 text-sm">
              <ReactMarkdown>{data.outro}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {(onCoachClick || onRegenerateClick) && (
          <div className="mt-8 flex flex-col gap-4">
            
            {onRegenerateClick && (
              <div>
                <button
                  onClick={onRegenerateClick}
                  className="w-full flex items-center justify-center gap-2 rounded-full border-2 border-primary bg-card py-4 text-base font-semibold text-primary transition-all hover:bg-primary/10 shadow-sm"
                >
                  <RefreshCcw className="w-5 h-5 text-primary" />
                  Generate Alternative Take
                </button>
                <p className="mt-2 text-center text-xs sm:text-sm text-muted-foreground">
                  Not feeling this approach? Let the AI spin a completely opposing creative direction.
                </p>
              </div>
            )}

            {onCoachClick && (
              <div>
                <button
                  onClick={onCoachClick}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-primary py-4 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 shadow-md"
                >
                  Take this to my Coach →
                </button>
                <p className="mt-2 text-center text-xs sm:text-sm text-muted-foreground">
                  Open a coaching session with this breakdown pre-loaded
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: SIDEBAR NAVIGATION */}
      {hasFullSections && (
        <div className="hidden lg:block sticky top-8 rounded-2xl bg-card text-card-foreground shadow-sm p-6 border border-border">
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">On this page</h4>
          <nav>
            <ul className="space-y-1.5">
              {sidebarLinks.map((link) => {
                const isActive = activeSection === link.id;
                
                return (
                  <li key={link.id}>
                    <button 
                      onClick={() => scrollToSection(link.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all border ${
                        isActive 
                          ? "bg-primary/10 text-primary border-primary/20 font-semibold" 
                          : "text-muted-foreground hover:bg-muted hover:text-foreground border-transparent"
                      }`}
                    >
                      <link.icon className="text-primary shrink-0" size={16} />
                      <span className="truncate">{link.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}