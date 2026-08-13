"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { 
  Target, 
  Eye, 
  User, 
  Heart, 
  Key, 
  Shield, 
  MessageCircle, 
  Video, 
  Dna, 
  Flame, 
  Info, 
  Users, 
  Clock, 
  Split, 
  Hourglass, 
  Brain, 
  Lock, 
  MapPin, 
  AlertTriangle, 
  RefreshCcw,
  ChevronDown
} from "lucide-react";
import React from "react";
import type { CriticalBriefFact } from "@/lib/audition-types";
import { cn } from "@/lib/utils";

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

  // Legacy breakdowns have 20 sections. New multi-scene breakdowns have 21.
  const hasFullSections = data?.sections && data.sections.length >= 20;
  
  // Check if we have the 21st section AND if it contains actual content (not the N/A fallback)
  const hasInBetweenSection = data?.sections?.length >= 21;
  const showInBetween = hasInBetweenSection && !data.sections[13]?.items[0]?.includes("N/A");

  // Offset pointer for 21-section format vs legacy 20-section schema
  const offset = hasInBetweenSection ? 1 : 0;

  const s = data?.sections;

  // Estado para controlar quais sanfonas/accordions estão abertos (por padrão o 'Objective' vem aberto)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "section-objective": true,
  });

  if (!data || !data.sections) return null;

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const renderMarkdown = (text: string) => (
    <div className="prose prose-neutral dark:prose-invert max-w-none prose-p:m-0 prose-p:inline prose-strong:font-semibold prose-strong:text-foreground">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );

  const scrollToSection = (id: string) => {
    // Garante que a seção seja aberta ao clicar no menu lateral
    setOpenSections((prev) => ({ ...prev, [id]: true }));
    setActiveSection(id);

    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ 
        behavior: "smooth", 
        block: "start" 
      });
    }
  };

  const sidebarLinks = [
    { id: "section-objective", icon: Target, label: "Objective" },
    { id: "section-snapshot", icon: Eye, label: "Snapshot" },
    { id: "section-character", icon: User, label: "Character Breakdown" },
    { id: "section-relationships", icon: Users, label: "Relationship Dynamics" },
    { id: "section-palette", icon: Heart, label: "Emotional Palette" },
    { id: "section-beats", icon: Key, label: "Key Beats / Turning Points" },
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
            className="rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 p-6 sm:p-8 scroll-mt-8 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="text-amber-500 shrink-0" size={22} aria-hidden="true" />
              <h3 id="critical-brief-facts-heading" className="text-xl font-title font-bold text-foreground italic">
                Critical facts from the casting brief
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4">
              Director- or casting-supplied facts that are non-negotiable for this audition. Honor these even when the sides do not mention them.
            </p>
            <ul className="space-y-3">
              {data.criticalBriefFacts.map((fact, i) => (
                <li
                  key={`${fact.label}-${i}`}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-card border border-border shadow-sm"
                >
                  <span
                    className={cn(
                      "shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                      fact.importance === "critical"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {fact.importance}
                  </span>
                  <div className="text-xs sm:text-sm text-foreground">
                    <span className="font-semibold">{fact.label}:</span>{" "}
                    <span className="text-muted-foreground">{fact.value}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Intro Section */}
        {data.intro && (
          <div className="rounded-2xl bg-card text-card-foreground shadow-sm p-6 border-l-4 border-primary border-t border-r border-b border-border">
            <div className="prose prose-neutral dark:prose-invert max-w-none text-sm sm:text-base italic leading-relaxed text-foreground">
              <ReactMarkdown>{data.intro}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Fallback para formatos sem 20 seções completas */}
        {!hasFullSections && data.sections.map((section, idx) => (
          <div key={idx} className="rounded-2xl bg-card text-card-foreground p-6 border border-border">
            <h3 className="text-lg font-bold text-foreground mb-3">{section.title}</h3>
            <div className="space-y-2 text-xs sm:text-sm">
              {section.items.map((item, i) => (
                <React.Fragment key={i}>{renderMarkdown(item)}</React.Fragment>
              ))}
            </div>
          </div>
        ))}

        {/* TODAS AS CATEGORIAS COMPLETAS EM SANFONA (ACCORDION) */}
        {hasFullSections && (
          <div className="space-y-3">

            {/* 1. Objective */}
            <AccordionCard
              id="section-objective"
              title="Objective"
              icon={Target}
              isOpen={!!openSections["section-objective"]}
              onToggle={() => toggleSection("section-objective")}
            >
              <div className="text-foreground text-xs sm:text-sm leading-relaxed">
                {s[0].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </AccordionCard>

            {/* 2. Snapshot */}
            <AccordionCard
              id="section-snapshot"
              title="Snapshot"
              icon={Eye}
              isOpen={!!openSections["section-snapshot"]}
              onToggle={() => toggleSection("section-snapshot")}
            >
              <div className="text-foreground text-xs sm:text-sm leading-relaxed">
                {s[1].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </AccordionCard>

            {/* 3, 4, 5. Character Breakdown */}
            <AccordionCard
              id="section-character"
              title="Character Breakdown"
              icon={User}
              isOpen={!!openSections["section-character"]}
              onToggle={() => toggleSection("section-character")}
            >
              <div className="space-y-5 text-xs sm:text-sm">
                <div>
                  <h4 className="font-bold text-foreground mb-1 font-title">Who they are</h4>
                  <div className="text-muted-foreground">{s[2].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}</div>
                </div>
                <hr className="border-border" />
                <div>
                  <h4 className="font-bold text-foreground mb-1 font-title">What they want</h4>
                  <div className="text-muted-foreground">{s[3].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}</div>
                </div>
                <hr className="border-border" />
                <div>
                  <h4 className="font-bold text-foreground mb-1 font-title">Contradictions</h4>
                  <div className="text-muted-foreground">{s[4].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}</div>
                </div>
              </div>
            </AccordionCard>

            {/* 6. Relationship Dynamics */}
            <AccordionCard
              id="section-relationships"
              title="Relationship Dynamics"
              icon={Users}
              isOpen={!!openSections["section-relationships"]}
              onToggle={() => toggleSection("section-relationships")}
            >
              <div className="text-foreground text-xs sm:text-sm leading-relaxed space-y-3">
                {s[5].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </AccordionCard>

            {/* 7. Emotional Palette */}
            <AccordionCard
              id="section-palette"
              title="Emotional Palette"
              icon={Heart}
              isOpen={!!openSections["section-palette"]}
              onToggle={() => toggleSection("section-palette")}
            >
              <div className="flex flex-wrap gap-2">
                {s[6].items.map((item, i) => (
                  <span key={i} className="px-3 py-1 rounded-full border border-border text-foreground text-xs bg-muted/50 font-medium">
                    {item.replace(/^\s*[-*•]\s*/, '').trim()}
                  </span>
                ))}
              </div>
            </AccordionCard>

            {/* 8. Key Beats / Turning Points */}
            <AccordionCard
              id="section-beats"
              title="Key Beats / Turning Points"
              icon={Key}
              isOpen={!!openSections["section-beats"]}
              onToggle={() => toggleSection("section-beats")}
            >
              <div className="space-y-4 text-xs sm:text-sm">
                {s[7].items.map((item, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-6 h-6 mt-0.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-[10px] font-bold">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="text-foreground leading-relaxed">
                      {renderMarkdown(item.replace(/^Beat \d+: /, ''))}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionCard>

            {/* 9 & 10. Tactics & Obstacles */}
            <AccordionCard
              id="section-tactics"
              title="Tactics and Obstacles"
              icon={Shield}
              isOpen={!!openSections["section-tactics"]}
              onToggle={() => toggleSection("section-tactics")}
            >
              <div className="space-y-6 text-xs sm:text-sm">
                <div>
                  <h4 className="font-bold text-foreground mb-2 font-title">Tactics — how she pursues</h4>
                  <ul className="space-y-2">
                    {s[8].items.map((item, i) => (
                      <li key={i} className="flex gap-2 items-start text-foreground">
                        <span className="text-primary shrink-0">•</span>
                        {renderMarkdown(item)}
                      </li>
                    ))}
                  </ul>
                </div>
                <hr className="border-border" />
                <div>
                  <h4 className="font-bold text-foreground mb-2 font-title">Obstacles — what blocks her</h4>
                  <ul className="space-y-2">
                    {s[9].items.map((item, i) => (
                      <li key={i} className="flex gap-2 items-start text-foreground">
                        <span className="text-primary shrink-0">•</span>
                        {renderMarkdown(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </AccordionCard>

            {/* 11. The Stakes */}
            <AccordionCard
              id="section-why-now"
              title="The Stakes"
              icon={Clock}
              isOpen={!!openSections["section-why-now"]}
              onToggle={() => toggleSection("section-why-now")}
            >
              <div className="text-foreground text-xs sm:text-sm leading-relaxed space-y-3">
                {s[10].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </AccordionCard>

            {/* 12 & 13. The Moment */}
            <AccordionCard
              id="section-moment"
              title="The Moment"
              icon={Hourglass}
              isOpen={!!openSections["section-moment"]}
              onToggle={() => toggleSection("section-moment")}
            >
              <div className="space-y-5 text-xs sm:text-sm">
                <div>
                  <h4 className="font-bold text-foreground mb-2 font-title">Moment Before</h4>
                  <div className="text-foreground">
                    {s[11].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
                  </div>
                </div>
                <hr className="border-border" />
                <div>
                  <h4 className="font-bold text-foreground mb-2 font-title">Moment After</h4>
                  <div className="text-foreground">
                    {s[12].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
                  </div>
                </div>
              </div>
            </AccordionCard>

            {/* CONDITIONAL SECTION: The In-Between */}
            {showInBetween && (
              <AccordionCard
                id="section-in-between"
                title="The In-Between"
                icon={Split}
                isOpen={!!openSections["section-in-between"]}
                onToggle={() => toggleSection("section-in-between")}
              >
                <div className="text-foreground text-xs sm:text-sm leading-relaxed space-y-3">
                  {s[13].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
                </div>
              </AccordionCard>
            )}

            {/* 14. Inner Monologue */}
            <AccordionCard
              id="section-monologue"
              title="Inner Monologue"
              icon={Brain}
              isOpen={!!openSections["section-monologue"]}
              onToggle={() => toggleSection("section-monologue")}
            >
              <ul className="space-y-2 text-xs sm:text-sm">
                {s[13+offset].items.map((item, i) => (
                  <li key={i} className="flex gap-2 items-start text-foreground">
                    <span className="text-primary shrink-0">•</span>
                    {renderMarkdown(item)}
                  </li>
                ))}
              </ul>
            </AccordionCard>

            {/* 15. The Secret */}
            <AccordionCard
              id="section-secret"
              title="The Secret"
              icon={Lock}
              isOpen={!!openSections["section-secret"]}
              onToggle={() => toggleSection("section-secret")}
            >
              <div className="space-y-3 text-xs sm:text-sm">
                {s[14+offset].items.map((item, i) => (
                  <div key={i} className="p-4 bg-primary/10 border border-primary/20 rounded-2xl italic text-foreground">
                    {renderMarkdown(item)}
                  </div>
                ))}
              </div>
            </AccordionCard>

            {/* 16. Physicality & Setting */}
            <AccordionCard
              id="section-physical"
              title="Physicality & Setting"
              icon={MapPin}
              isOpen={!!openSections["section-physical"]}
              onToggle={() => toggleSection("section-physical")}
            >
              <ul className="space-y-2 text-xs sm:text-sm">
                {s[15+offset].items.map((item, i) => (
                  <li key={i} className="flex gap-2 items-start text-foreground">
                    <span className="text-primary shrink-0">•</span>
                    {renderMarkdown(item)}
                  </li>
                ))}
              </ul>
            </AccordionCard>

            {/* 17. Coach Notes */}
            <AccordionCard
              id="section-notes"
              title="Coach Notes"
              icon={MessageCircle}
              isOpen={!!openSections["section-notes"]}
              onToggle={() => toggleSection("section-notes")}
            >
              <div className="text-foreground text-xs sm:text-sm leading-relaxed space-y-3">
                {s[16+offset].items.map((item, i) => <div key={i}>{renderMarkdown(item)}</div>)}
              </div>
            </AccordionCard>

            {/* 18. Self-Tape Plan */}
            <AccordionCard
              id="section-tape"
              title="Self-Tape Plan"
              icon={Video}
              isOpen={!!openSections["section-tape"]}
              onToggle={() => toggleSection("section-tape")}
            >
              <ul className="space-y-3 text-xs sm:text-sm">
                {s[17+offset].items.map((item, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <div className="w-4 h-4 mt-0.5 border border-border rounded shrink-0 bg-muted/40" />
                    <div className="text-foreground">
                      {renderMarkdown(item)}
                    </div>
                  </li>
                ))}
              </ul>
            </AccordionCard>

            {/* 19. The Bold Choice */}
            <AccordionCard
              id="section-bold-choice"
              title="The Bold Choice"
              icon={Flame}
              isOpen={!!openSections["section-bold-choice"]}
              onToggle={() => toggleSection("section-bold-choice")}
            >
              <div className="space-y-3 text-xs sm:text-sm">
                {s[18+offset].items.map((item, i) => (
                  <div key={i} className="p-4 bg-primary/10 border border-primary/20 rounded-2xl text-foreground">
                    {renderMarkdown(item)}
                  </div>
                ))}
              </div>
            </AccordionCard>

            {/* 20. Personal DNA */}
            <AccordionCard
              id="section-dna"
              title="Personal DNA"
              icon={Dna}
              isOpen={!!openSections["section-dna"]}
              onToggle={() => toggleSection("section-dna")}
            >
              <div className="space-y-3 text-xs sm:text-sm">
                <h4 className="font-bold text-foreground font-title">Suggested reservoirs to access for this role</h4>
                <div className="flex flex-wrap gap-2">
                  {s[19+offset].items.map((item, i) => {
                     const isShortTag = item.length < 30 && !item.includes(':');
                     if (isShortTag) {
                       return (
                         <span key={i} className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold text-xs">
                           {item.replace(/^\s*[-*•]\s*/, '').trim()}
                         </span>
                       );
                     }
                     return <div key={i} className="w-full text-foreground mt-1">{renderMarkdown(item)}</div>;
                  })}
                </div>
              </div>
            </AccordionCard>

          </div>
        )}

        {/* Outro Text */}
        {data.outro && (
          <div className="p-6 text-muted-foreground text-center">
            <div className="prose prose-neutral dark:prose-invert max-w-none italic text-xs sm:text-sm">
              <ReactMarkdown>{data.outro}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {(onCoachClick || onRegenerateClick) && (
          <div className="pt-6 flex flex-col gap-4">
            {onCoachClick && (
              <div className="space-y-1 text-center">
                <button
                  onClick={onCoachClick}
                  className="w-full py-3.5 px-6 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <span>Take this to my Coach</span>
                  <span className="text-base">→</span>
                </button>
                <p className="text-[11px] text-muted-foreground">
                  Open a coaching session with this breakdown pre-loaded
                </p>
              </div>
            )}

            {onRegenerateClick && (
              <div className="space-y-1 text-center">
                <button
                  onClick={onRegenerateClick}
                  className="w-full py-3 px-6 rounded-full border border-border bg-card hover:bg-muted text-foreground font-semibold text-xs sm:text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <RefreshCcw className="w-4 h-4 text-primary" />
                  <span>Generate Alternative Take</span>
                </button>
                <p className="text-[11px] text-muted-foreground">
                  Not feeling this approach? Let the AI spin a completely opposing creative direction.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: SIDEBAR NAVIGATION */}
      {hasFullSections && (
        <div className="hidden lg:block sticky top-8 rounded-3xl bg-card text-card-foreground shadow-sm p-5 border border-border">
          <nav className="relative pl-2">
            {/* Linha Vertical Conduzindo */}
            <div className="absolute left-2.5 top-2 bottom-2 w-[2px] bg-border" />

            <ul className="space-y-2 relative z-10">
              {sidebarLinks.map((link) => {
                const isActive = activeSection === link.id;
                const Icon = link.icon;
                
                return (
                  <li key={link.id}>
                    <button 
                      onClick={() => scrollToSection(link.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all text-left",
                        isActive 
                          ? "text-primary font-semibold" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
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

/**
 * Componente Auxiliar de Card Sanfonado (Accordion)
 */
function AccordionCard({
  id,
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: React.ElementType;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden scroll-mt-8 transition-colors"
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left font-title font-bold text-foreground text-sm sm:text-base hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-primary shrink-0" />
          <span>{title}</span>
        </div>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180 text-foreground"
          )}
        />
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-1 border-t border-border/50 animate-in fade-in duration-150">
          {children}
        </div>
      )}
    </div>
  );
}