"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Globe, Clapperboard, UserCircle, Shirt, Users, Dna } from "lucide-react";
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

/**
 * StepResultBrief Component
 * Renders the AI-generated analysis specifically for Character Briefs and Casting Notes.
 * Displays sections like World & Tone, Director's Vision, and Archetypes.
 * * @param {StepResultProps} props - The structured data returned by the Gemini AI.
 */
export function StepResultBrief({ data }: StepResultProps) {
  // State to track which section is currently visible in the viewport for the sidebar highlight
  const [activeSection, setActiveSection] = useState("section-world");
  
  // We expect 6 specific sections for a Brief analysis. If we get less, we fall back to a generic list.
  const hasFullSections = data?.sections && data.sections.length >= 6;
  
  useEffect(() => {
    if (!hasFullSections) return;
    
    // Intersection Observer to highlight the active section in the sidebar as the user scrolls
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
  }, [hasFullSections]);

  if (!data || !data.sections) return null;

  const s = data.sections;

  /**
   * Helper function to render markdown content with consistent typography styling.
   */
  const renderMarkdown = (text: string) => (
    <div className="prose prose-slate max-w-none prose-p:m-0 prose-p:inline prose-strong:font-semibold prose-strong:text-gray-900">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );

  /**
   * Smoothly scrolls to the clicked section from the sidebar.
   */
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

  // Sidebar navigation tailored for Brief Analysis
  const sidebarLinks = [
    { id: "section-world", icon: Globe, label: "Project World & Tone" },
    { id: "section-vision", icon: Clapperboard, label: "Director's Vision" },
    { id: "section-archetype", icon: UserCircle, label: "Character Archetype" },
    { id: "section-physicality", icon: Shirt, label: "Physicality & Vibe" },
    { id: "section-relationships", icon: Users, label: "Key Relationships" },
    { id: "section-dna", icon: Dna, label: "DNA Alignment" },
  ];

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10 items-start mt-8 pb-12 font-sans relative">
      
      {/* LEFT COLUMN: MAIN CONTENT */}
      <div className="space-y-6">
        
        {/* Intro Block */}
        {data.intro && (
          <div className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border-l-4 border-[#FF7316]">
            <div className="prose prose-slate max-w-none prose-p:text-lg prose-p:italic prose-p:leading-relaxed text-gray-700">
              <ReactMarkdown>{data.intro}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Fallback View (if the AI returns an unexpected number of sections) */}
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

        {/* Full Structured View for Briefs */}
        {hasFullSections && (
          <>
            {/* 1. Project World & Tone */}
            <div id="section-world" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Globe className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Project World & Tone</h3>
              </div>
              <div className="text-gray-700 text-[15px] leading-relaxed space-y-3">
                {s[0].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </div>

            {/* 2. Director's Vision */}
            <div id="section-vision" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Clapperboard className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Director's Vision</h3>
              </div>
              <div className="text-gray-700 text-[15px] leading-relaxed space-y-3">
                {s[1].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </div>

            {/* 3. Character Archetype */}
            <div id="section-archetype" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <UserCircle className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Character Archetype</h3>
              </div>
              <ul className="space-y-4">
                {s[2].items.map((item, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="text-[#FF7316] mt-0.5 shrink-0 text-lg leading-none">•</span>
                    <div className="text-gray-700 text-[15px]">
                      {renderMarkdown(item)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* 4. Physicality & Vibe */}
            <div id="section-physicality" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Shirt className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Physicality & Vibe</h3>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {s[3].items.map((item, i) => (
                  <span key={i} className="px-4 py-1.5 rounded-full border border-gray-300 text-gray-700 text-sm bg-transparent">
                    {item.replace(/^\s*[-*•]\s*/, '').trim()}
                  </span>
                ))}
              </div>
            </div>

            {/* 5. Key Relationships */}
            <div id="section-relationships" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Users className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">Key Relationships</h3>
              </div>
              <div className="space-y-4 text-gray-700 text-[15px] leading-relaxed">
                {s[4].items.map((item, i) => (
                  <div key={i} className="p-4 bg-white border border-gray-100 rounded-xl">
                    {renderMarkdown(item)}
                  </div>
                ))}
              </div>
            </div>

            {/* 6. DNA Alignment */}
            <div id="section-dna" className="rounded-2xl bg-[#FCFAF7] shadow-sm p-6 sm:p-8 border border-gray-200/50 scroll-mt-8">
              <div className="flex items-center gap-3 mb-6">
                <Dna className="text-[#FF7316]" size={24} />
                <h3 className="text-xl font-bold text-gray-900">DNA Alignment</h3>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 mb-3 text-sm tracking-tight">How your unique profile fits this role</h4>
                <div className="flex flex-wrap gap-2.5">
                  {s[5].items.map((item, i) => {
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

        {/* Outro Block */}
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