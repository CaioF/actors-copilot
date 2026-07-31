"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Dna,
  CheckCircle2,
  X,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DNA_SECTIONS, ARENA_THEMES, THEME_DISPLAY_NAMES } from "@/lib/chat-types";
import type { DNASession, DNASectionId } from "@/lib/chat-types";
import { useState, useMemo, useEffect } from "react";
import { useSidebar } from "@/lib/context/SidebarContext";
import { usePathname } from "next/navigation";

interface SectionProgressRingProps {
  current: number;
  total: number;
  isCompleted: boolean;
  sectionId: DNASectionId;
  themesCovered?: string[];
}

interface FirebaseTimestamp {
  seconds: number;
  nanoseconds?: number;
}

const isFirebaseTimestamp = (value: unknown): value is FirebaseTimestamp => {
  return (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as Record<string, unknown>).seconds === "number"
  );
};

const normalizeDate = (dateValue: unknown): Date | null => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  
  if (isFirebaseTimestamp(dateValue)) {
    return new Date(dateValue.seconds * 1000);
  }
  
  if (typeof dateValue === "string" || typeof dateValue === "number") {
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  
  return null;
};

/**
 * Component representing the graphical progress loop for individual core identity areas.
 * @param {SectionProgressRingProps} props - Structural presentation parameters.
 * @returns {JSX.Element} The rendered progress SVG ring boundary.
 */
function SectionProgressRing({ current, total, isCompleted, sectionId, themesCovered = [] }: SectionProgressRingProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const size = 16;
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(current / total, 1);
  const strokeDashoffset = circumference * (1 - progress);

  const allThemes = ARENA_THEMES[sectionId] || [];
  const themesCoveredSet = new Set(themesCovered);
  const exploredThemes = allThemes.filter(t => themesCoveredSet.has(t));
  const missingThemes = allThemes.filter(t => !themesCoveredSet.has(t));

  const ring = isCompleted ? (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-primary"
          strokeWidth={strokeWidth}
        />
      </svg>
      <CheckCircle2 className="absolute h-3.5 w-3.5 text-primary" />
    </div>
  ) : (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-sidebar-foreground/20"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-primary transition-all duration-300"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );

  const tooltipId = `theme-tooltip-${sectionId}`;

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className="flex items-center justify-center rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        aria-describedby={showTooltip ? tooltipId : undefined}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        {ring}
      </div>
      {showTooltip && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute left-6 top-0 z-50 w-36 rounded-md bg-sidebar p-2 text-[10px] text-sidebar-foreground shadow-lg border border-sidebar-border"
        >
          {exploredThemes.length > 0 && (
            <div className="mb-1">
              <p className="mb-0.5 font-medium text-primary">Explored:</p>
              <ul className="space-y-0">
                {exploredThemes.map(theme => (
                  <li key={theme} className="flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-primary" />
                    {THEME_DISPLAY_NAMES[theme] || theme}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {missingThemes.length > 0 && (
            <div>
              <p className="mb-0.5 font-medium text-sidebar-foreground/50">To explore:</p>
              <ul className="space-y-0 text-sidebar-foreground/40">
                {missingThemes.map(theme => (
                  <li key={theme} className="flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-sidebar-foreground/40" />
                    {THEME_DISPLAY_NAMES[theme] || theme}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {exploredThemes.length === 0 && missingThemes.length === 0 && (
            <p className="text-sidebar-foreground/40">No themes explored yet</p>
          )}
        </div>
      )}
    </div>
  );
}

const HQ_EXTRACTIONS_FOR_COMPLETION = 5;

interface ChatSidebarProps {
  session: DNASession | null;
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
}

/**
 * ChatSidebar Component.
 * Focused sidebar navigation for the DNA Chat interface, displaying progress and sections only.
 * @param {ChatSidebarProps} props - The operational layout properties.
 * @returns {JSX.Element} Streamlined chat sidebar layout wrapper.
 */
export function ChatSidebar({
  session,
  activeSection,
  onSectionClick,
}: ChatSidebarProps) {
  const pathname = usePathname();
  const { isOpen, setIsOpen } = useSidebar();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname, setIsOpen]);

  const { formattedLastActive } = useMemo(() => {
    const lastDate = normalizeDate(session?.lastActiveAt);
    
    const formattedDate = lastDate
      ? lastDate.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "No recent activity";

    return {
      formattedLastActive: formattedDate,
    };
  }, [session?.lastActiveAt]);

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-55 transform flex-col overflow-y-auto bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 dark:text-sidebar-foreground",
          "md:relative md:z-auto md:h-auto md:w-55 md:shrink-0 md:translate-x-0 md:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Mobile Close Button */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close menu"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Back to Dashboard Button */}
        <div className="px-4 pt-5 pb-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2 text-xs font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-primary" />
            <span>Back to Dashboard</span>
          </Link>
        </div>

        {/* App Logo */}
        <div className="flex items-center justify-center px-5 py-3">
          <Link href="/dashboard" className="block transition-transform hover:scale-105">
            <Image
              src="/logo.png"
              alt="The Actors Copilot"
              width={90}
              height={90}
              className="object-contain"
              priority
            />
          </Link>
        </div>

        <div className="mx-5 mb-2 border-t border-sidebar-border" />

        {/* Section Title */}
        <div className="px-5 pb-2">
          <h3 className="mt-1 font-title text-base italic leading-snug text-primary">
            Continue your discovery
          </h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-sidebar-foreground/60">
            Last session: {formattedLastActive} 
          </p>
        </div>

        {/* DNA Progress Sections */}
        <div className="px-5 flex-1 overflow-y-auto custom-scrollbar pb-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Dna className="h-3.5 w-3.5 text-sidebar-foreground/50" />
            <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
              DNA Sections
            </span>
          </div>
          <nav className="flex flex-col gap-0.5 pl-1">
            {DNA_SECTIONS.map((section) => {
              const isCompleted = session?.completedSections?.includes(section.id);
              const extractionCount = session?.sectionHqCounts?.[section.id] ?? 0;

              return (
                <button
                  key={section.id}
                  onClick={() => onSectionClick(section.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                    activeSection === section.id
                      ? "font-medium text-primary bg-primary/10"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <SectionProgressRing
                    current={extractionCount}
                    total={HQ_EXTRACTIONS_FOR_COMPLETION}
                    isCompleted={isCompleted ?? false}
                    sectionId={section.id}
                    themesCovered={session?.sectionThemes?.[section.id]}
                  />
                  <span className="flex-1">{section.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Global Progress Bar */}
        <div className="px-5 pb-6 flex-shrink-0">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-sidebar-foreground/15">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${session?.progress ?? 10}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-sidebar-foreground/60">
            Progress: {session?.progress ?? 10}%
          </p>
        </div>
      </aside>
    </>
  );
}