"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Target, Eye, User, Heart, Key, Shield, MessageCircle, Video, Dna } from "lucide-react";
import React from "react";

interface Section {
  title: string;
  items: string[];
}

interface StepResultProps {
  data: {
    intro?: string;
    sections: Section[];
    outro?: string;
  };
}

export function StepResult({ data }: StepResultProps) {
  // Estado para controlar qual seção está ativa na sidebar
  const [activeSection, setActiveSection] = useState("section-objective");

  // Configura o Intersection Observer para mudar a aba ativa conforme o scroll manual
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" } 
    );

    const sections = document.querySelectorAll('div[id^="section-"]');
    sections.forEach((s) => observer.observe(s));

    return () => observer.disconnect();
  }, []);

  if (!data || !data.sections) return null;

  const s = data.sections;
  const hasFullSections = s.length >= 12;

  const renderMarkdown = (text: string) => (
    <div className="prose prose-slate max-w-none prose-p:m-0 prose-p:inline prose-strong:font-semibold prose-strong:text-gray-900">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );

  // CORREÇÃO: Usando scrollIntoView para garantir que funciona em qualquer container
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // scrollIntoView encontra automaticamente o container correto
      element.scrollIntoView({ 
        behavior: "smooth", 
        block: "start" 
      });
      // Força a atualização do estado visual imediatamente no clique
      setActiveSection(id);
    }
  };

  // Definição do menu da Sidebar
  const sidebarLinks = [
    { id: "section-objective", icon: Target, label: "Objective" },
    { id: "section-snapshot", icon: Eye, label: "Snapshot" },
    { id: "section-character", icon: User, label: "Character Breakdown" },
    { id: "section-palette", icon: Heart, label: "Emotional Palette" },
    { id: "section-beats", icon: Key, label: "Key Beats" },
    { id: "section-tactics", icon: Shield, label: "Tactics & Obstacles" },
    { id: "section-notes", icon: MessageCircle, label: "Coach Notes" },
    { id: "section-tape", icon: Video, label: "Self-Tape Plan" },
    { id: "section-dna", icon: Dna, label: "Personal DNA" },
  ];

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10 items-start mt-8 pb-12 font-sans relative">
      
      {/* LEFT COLUMN: MAIN CONTENT */}
      <div className="space-y-6">
        
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

            {/* 6. Emotional Palette */}
            <div id="section-palette" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Heart className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Emotional Palette</h3>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {s[5].items.map((item, i) => (
                  <span key={i} className="px-4 py-1.5 rounded-full border border-gray-300 text-gray-700 text-sm bg-transparent">
                    {item.replace(/^\s*[-*•]\s*/, '').trim()}
                  </span>
                ))}
              </div>
            </div>

            {/* 7. Key Beats / Turning Points */}
            <div id="section-beats" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Key className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Key Beats / Turning Points</h3>
              </div>
              <div className="space-y-5">
                {s[6].items.map((item, i) => (
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

            {/* 8 & 9. Tactics & Obstacles */}
            <div id="section-tactics" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Tactics & Obstacles</h3>
              </div>
              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-3 font-title tracking-tight">Tactics — how she pursues</h4>
                <ul className="space-y-3">
                  {s[7].items.map((item, i) => (
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
                  {s[8].items.map((item, i) => (
                    <li key={i} className="flex gap-3 items-start text-gray-700 text-[15px]">
                      <span className="text-[#FF7316] mt-0.5 shrink-0 text-lg leading-none">•</span>
                      {renderMarkdown(item)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 10. Coach Notes */}
            <div id="section-notes" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <MessageCircle className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Coach Notes</h3>
              </div>
              <div className="space-y-4 text-gray-700 text-[15px] leading-relaxed">
                {s[9].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </div>

            {/* 11. Self-Tape Plan */}
            <div id="section-tape" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Video className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Self-Tape Plan</h3>
              </div>
              <ul className="space-y-4">
                {s[10].items.map((item, i) => (
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

            {/* 12. Personal DNA */}
            <div id="section-dna" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Dna className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Personal DNA Connection</h3>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 mb-3 text-sm tracking-tight">Suggested reservoirs to access for this role</h4>
                <div className="flex flex-wrap gap-2.5">
                  {s[11].items.map((item, i) => {
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