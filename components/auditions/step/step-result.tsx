"use client";

import { useState, useEffect } from "react";
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

export function StepResultSides({ data, onCoachClick, onRegenerateClick }: StepResultProps) {
  
  const [activeSection, setActiveSection] = useState("section-objective");
  //  Backward Compatibility & Conditional Hydration
  // Legacy breakdowns have 20 sections. New multi-scene breakdowns have 21.
  const isLegacySchema = data?.sections && data.sections.length === 20;
  const hasFullSections = data?.sections && data.sections.length >= 20;
  
  // Check if we have the 21st section AND if it contains actual content (not the N/A fallback)
  const hasInBetweenSection = data?.sections?.length >= 21;
  const showInBetween = hasInBetweenSection && !data.sections[13]?.items[0]?.includes("N/A");

  // We use an offset pointer. If it's a new 21-section format, everything after 
  // index 13 shifts by +1. If it's legacy, the offset is 0, keeping old data safe.
  const offset = hasInBetweenSection ? 1 : 0;

  const s = data.sections;
  if (!data || !data.sections) return null;

  const renderMarkdown = (text: string) => (
    <div className="prose prose-slate max-w-none prose-p:m-0 prose-p:inline prose-strong:font-semibold prose-strong:text-gray-900">
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
    <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10 items-start mt-8 pb-12 font-sans relative">
      
      {/* LEFT COLUMN: MAIN CONTENT */}
      <div className="space-y-6">

        {/* Top Instructional Notice Banner */}
        {/* Positioned at the absolute top of the content flow to immediately orient the user before processing details. */}
        <div className="flex items-center gap-3 px-5 py-4 bg-[#FCFAF7] border border-gray-200/60 rounded-2xl shadow-sm text-sm text-gray-600 font-medium">
          <Info size={18} className="text-[#FF7316] shrink-0" />
          <span>Read the generated breakdown. If you don't like it or want </span>
        </div>

        {/* CRITICAL BRIEF FACTS — director/casting-supplied non-negotiables that must be honored
            even if they are not present in the sides text. Rendered prominently above the
            normal analysis so the actor reads them first. */}
        {data.criticalBriefFacts && data.criticalBriefFacts.length > 0 && (
          <section
            id="section-critical-brief-facts"
            role="region"
            aria-labelledby="critical-brief-facts-heading"
            className="rounded-2xl bg-[#FFF1E8] border-2 border-[#FF7316] shadow-sm p-6 sm:p-8 scroll-mt-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-[#FF7316]" size={24} aria-hidden="true" />
              <h3 id="critical-brief-facts-heading" className="text-xl font-bold text-[#7A2E00]">
                Critical Facts from the Casting Brief
              </h3>
            </div>
            <p className="text-sm text-[#7A2E00]/80 mb-4">
              Director- or casting-supplied facts that are non-negotiable for this audition. Honor these even when the sides do not mention them.
            </p>
            <ul className="space-y-3">
              {data.criticalBriefFacts.map((fact, i) => (
                <li
                  key={`${fact.label}-${i}`}
                  className="flex items-start gap-3 p-3 rounded-lg bg-white border border-[#FF7316]/30"
                >
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      fact.importance === "critical"
                        ? "bg-[#FF7316] text-white"
                        : "bg-[#FFE0CC] text-[#7A2E00]"
                    }`}
                  >
                    {fact.importance}
                  </span>
                  <div className="text-[15px] text-[#2C3328]">
                    <span className="font-semibold">{fact.label}:</span>{" "}
                    <span>{fact.value}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.intro && (
          <div className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border-l-4 border-[#FF7316]">
            <div className="prose prose-slate max-w-none prose-p:text-lg prose-p:italic prose-p:leading-relaxed text-gray-700">
              <ReactMarkdown>{data.intro}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Fallback */}
        {!hasFullSections && data.sections.map((section, idx) => (
           <div key={idx} className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50">
             <h3 className="text-xl font-bold text-gray-900 mb-4">{section.title}</h3>
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
            <div id="section-objective" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Target className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Objective</h3>
              </div>
              <div className="text-gray-700 text-[15px] leading-relaxed">
                {s[0].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </div>

            {/* 2. Snapshot */}
            <div id="section-snapshot" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Eye className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Snapshot</h3>
              </div>
              <div className="text-gray-700 text-[15px] leading-relaxed">
                {s[1].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </div>

            {/* 3, 4, 5. Character Breakdown */}
            <div id="section-character" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <User className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Character Breakdown</h3>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 font-title tracking-tight">Who they are</h4>
                  <div className="text-gray-700 text-[15px]">{s[2].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}</div>
                </div>
                <hr className="border-gray-200" />
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 font-title tracking-tight">What they want</h4>
                  <div className="text-gray-700 text-[15px]">{s[3].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}</div>
                </div>
                <hr className="border-gray-200" />
                <div>
                  <h4 className="font-bold text-gray-900 mb-2 font-title tracking-tight">Contradictions</h4>
                  <div className="text-gray-700 text-[15px]">{s[4].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}</div>
                </div>
              </div>
            </div>

            {/* 6. Relationship Dynamics */}
            <div id="section-relationships" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Users className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Relationship Dynamics</h3>
              </div>
              <div className="space-y-4 text-gray-700 text-[15px] leading-relaxed">
                {s[5].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </div>

            {/* 7. Emotional Palette */}
            <div id="section-palette" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Heart className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Emotional Palette</h3>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {s[6].items.map((item, i) => (
                  <span key={i} className="px-4 py-1.5 rounded-full border border-gray-300 text-gray-700 text-sm bg-transparent">
                    {item.replace(/^\s*[-*•]\s*/, '').trim()}
                  </span>
                ))}
              </div>
            </div>

            {/* 8. Key Beats / Turning Points */}
            <div id="section-beats" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Key className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Key Beats / Turning Points</h3>
              </div>
              <div className="space-y-5">
                {s[7].items.map((item, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="w-7 h-7 mt-0.5 rounded-full bg-[#FF7316] text-white flex items-center justify-center shrink-0 text-xs font-bold">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="text-gray-700 text-[15px] leading-relaxed">
                      {renderMarkdown(item.replace(/^Beat \d+: /, ''))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 9 & 10. Tactics & Obstacles */}
            <div id="section-tactics" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Tactics & Obstacles</h3>
              </div>
              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-3 font-title tracking-tight">Tactics — how she pursues</h4>
                <ul className="space-y-3">
                  {s[8].items.map((item, i) => (
                    <li key={i} className="flex gap-3 items-start text-gray-700 text-[15px]">
                      <span className="text-[#FF7316] mt-0.5 shrink-0 text-lg leading-none">•</span>
                      {renderMarkdown(item)}
                    </li>
                  ))}
                </ul>
              </div>
              <hr className="border-gray-200 my-6" />
              <div>
                <h4 className="font-bold text-gray-900 mb-3 font-title tracking-tight">Obstacles — what blocks her</h4>
                <ul className="space-y-3">
                  {s[9].items.map((item, i) => (
                    <li key={i} className="flex gap-3 items-start text-gray-700 text-[15px]">
                      <span className="text-[#FF7316] mt-0.5 shrink-0 text-lg leading-none">•</span>
                      {renderMarkdown(item)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 11. The Stakes */}
            <div id="section-why-now" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">The Stakes</h3>
              </div>
              <div className="space-y-4 text-gray-700 text-[15px] leading-relaxed">
                {s[10].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </div>

            {/* 12 & 13. The Moment */}
            <div id="section-moment" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Hourglass className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">The Moment</h3>
              </div>
              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-3 font-title tracking-tight">Moment Before</h4>
                <div className="text-gray-700 text-[15px]">
                  {s[11].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
                </div>
              </div>
              <hr className="border-gray-200 my-6" />
              <div>
                <h4 className="font-bold text-gray-900 mb-3 font-title tracking-tight">Moment After</h4>
                <div className="text-gray-700 text-[15px]">
                  {s[12].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
                </div>
              </div>
            </div>

            {/*CONDITIONAL SECTION: The In-Between */}
            {showInBetween && (
              <div id="section-in-between" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
                <div className="flex items-center gap-3 mb-4">
                  <Split className="text-[#FF7316]" size={24} />
                  <h3 className="text-xl font-bold text-gray-900">The In-Between</h3>
                </div>
                <div className="space-y-4 text-gray-700 text-[15px] leading-relaxed">
                  {/* Always lives at index 13 on the new schema */}
                  {s[13].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
                </div>
              </div>
            )}

            {/* 14. Inner Monologue */}
            <div id="section-monologue" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Brain className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Inner Monologue</h3>
              </div>
              <ul className="space-y-3">
                {s[13+offset].items.map((item, i) => (
                  <li key={i} className="flex gap-3 items-start text-gray-700 text-[15px]">
                    <span className="text-[#FF7316] mt-0.5 shrink-0 text-lg leading-none">•</span>
                    {renderMarkdown(item)}
                  </li>
                ))}
              </ul>
            </div>

            {/* 15. The Secret */}
            <div id="section-secret" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">The Secret</h3>
              </div>
              <div className="space-y-4 text-gray-700 text-[15px] leading-relaxed">
                {s[14+offset].items.map((item, i) => (
                  <div key={i} className="p-5 bg-[#FDECE2]/40 border border-[#FDECE2] rounded-xl italic">
                    {renderMarkdown(item)}
                  </div>
                ))}
              </div>
            </div>

            {/* 16. Physicality & Setting */}
            <div id="section-physical" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Physicality & Setting</h3>
              </div>
              <ul className="space-y-3">
                {s[15+offset].items.map((item, i) => (
                  <li key={i} className="flex gap-3 items-start text-gray-700 text-[15px]">
                    <span className="text-[#FF7316] mt-0.5 shrink-0 text-lg leading-none">•</span>
                    {renderMarkdown(item)}
                  </li>
                ))}
              </ul>
            </div>

            {/* 17. Coach Notes */}
            <div id="section-notes" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <MessageCircle className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Coach Notes</h3>
              </div>
              <div className="space-y-4 text-gray-700 text-[15px] leading-relaxed">
                {s[16+offset].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </div>

            {/* 18. Self-Tape Plan */}
            <div id="section-tape" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Video className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Self-Tape Plan</h3>
              </div>
              <ul className="space-y-4">
                {s[17+offset].items.map((item, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <div
                      aria-hidden="true"
                      className="w-4 h-4 mt-1 border border-gray-400 rounded-[3px] shrink-0"
                    />
                    <div className="text-gray-700 text-[15px]">
                      {renderMarkdown(item)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* 19. The Bold Choice */}
            <div id="section-bold-choice" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Flame className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">The Bold Choice</h3>
              </div>
              <div className="space-y-4 text-gray-700 text-[15px] leading-relaxed">
                {s[18+offset].items.map((item, i) => (
                  <div key={i} className="p-5 bg-[#FDECE2]/50 border border-[#FDECE2] rounded-xl">
                    {renderMarkdown(item)}
                  </div>
                ))}
              </div>
            </div>

            {/* 20. Personal DNA */}
            <div id="section-dna" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Dna className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Personal DNA Connection</h3>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 mb-3 text-sm tracking-tight">Suggested reservoirs to access for this role</h4>
                <div className="flex flex-wrap gap-2.5">
                  {s[19+offset].items.map((item, i) => {
                     const isShortTag = item.length < 30 && !item.includes(':');
                     if (isShortTag) {
                       return (
                         <span key={i} className="px-4 py-1.5 rounded-full bg-[#FDECE2] text-[#FF7316] text-xs font-semibold">
                           {item.replace(/^\s*[-*•]\s*/, '').trim()}
                         </span>
                       )
                     }
                     return <div key={i} className="w-full text-gray-700 text-[15px] mt-2">{renderMarkdown(item)}</div>
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {data.outro && (
          <div className="rounded-2xl bg-transparent p-6 sm:p-8 text-gray-600 text-center">
            <div className="prose prose-slate max-w-none prose-p:italic prose-p:m-0 text-sm">
              <ReactMarkdown>{data.outro}</ReactMarkdown>
            </div>
          </div>
        )}

        {(onCoachClick || onRegenerateClick) && (
          <div className="mt-8 flex flex-col gap-4">
            
            {onRegenerateClick && (
              <div>
                <button
                  onClick={onRegenerateClick}
                  className="w-full flex items-center justify-center gap-2 rounded-full border-2 border-[#E8721A] bg-white py-4 text-base font-semibold text-[#E8721A] transition-colors hover:bg-[#FFF1E8]"
                >
                  <RefreshCcw className="w-5 h-5" />
                  Generate Alternative Take
                </button>
                <p className="mt-2 text-center text-sm text-[#6B6B6B]">
                  Not feeling this approach? Let the AI spin a completely opposing creative direction.
                </p>
              </div>
            )}

            {onCoachClick && (
              <div>
                <button
                  onClick={onCoachClick}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-[#E8721A] py-4 text-base font-semibold text-white transition-colors hover:bg-[#d66a18]"
                >
                  Take this to my Coach →
                </button>
                <p className="mt-2 text-center text-sm text-[#6B6B6B]">
                  Open a coaching session with this breakdown pre-loaded
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: SIDEBAR NAVIGATION */}
       {hasFullSections && (
        <div className="hidden lg:block sticky top-10 rounded-2xl bg-[#FCFAF7] shadow-sm p-6 border border-gray-200/50">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">On this page</h4>
          <nav>
            <ul className="space-y-2">
              {sidebarLinks.map((link) => {
                const isActive = activeSection === link.id;
                
                return (
                  <li key={link.id}>
                    <button 
                      onClick={() => scrollToSection(link.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                        isActive 
                          ? "bg-[#FDECE2] text-[#FF7316] border-transparent" 
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-transparent hover:border-gray-200"
                      }`}
                    >
                      <link.icon className="text-[#FF7316]" size={18} />
                      {link.label}
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