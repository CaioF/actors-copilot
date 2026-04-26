"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image"
import {
  LayoutDashboard,
  MessageCircle,
  Monitor,
  Dna,
  Settings,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DNA_SECTIONS, ARENA_THEMES, THEME_DISPLAY_NAMES } from "@/lib/chat-types";
import type { DNASession, DNASectionId } from "@/lib/chat-types";
import { useState } from "react";

interface SectionProgressRingProps {
  current: number;
  total: number;
  isCompleted: boolean;
  sectionId: DNASectionId;
  themesCovered?: string[];
}

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
          stroke="#E8721A"
          strokeWidth={strokeWidth}
        />
      </svg>
      <CheckCircle2 className="absolute h-3.5 w-3.5 text-[#E8721A]" />
    </div>
  ) : (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#2C3328"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E8721A"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300"
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
        className="flex items-center justify-center rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-[#E8721A]"
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
          className="absolute left-6 top-0 z-50 w-36 rounded-md bg-[#2C3328] p-2 text-[10px] text-[#F5F0E8] shadow-lg border border-[#3D4A3C]">
          {exploredThemes.length > 0 && (
            <div className="mb-1">
              <p className="mb-0.5 font-medium text-[#E8721A]">Explored:</p>
              <ul className="space-y-0">
                {exploredThemes.map(theme => (
                  <li key={theme} className="flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-[#E8721A]" />
                    {THEME_DISPLAY_NAMES[theme] || theme}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {missingThemes.length > 0 && (
            <div>
              <p className="mb-0.5 font-medium text-[#F5F0E8]/50">To explore:</p>
              <ul className="space-y-0 text-[#F5F0E8]/40">
                {missingThemes.map(theme => (
                  <li key={theme} className="flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-[#F5F0E8]/40" />
                    {THEME_DISPLAY_NAMES[theme] || theme}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {exploredThemes.length === 0 && missingThemes.length === 0 && (
            <p className="text-[#F5F0E8]/40">No themes explored yet</p>
          )}
        </div>
      )}
    </div>
  );
}

const HQ_EXTRACTIONS_FOR_COMPLETION = 5;

const menuItems = [
  { label: "Personal DNA", href: "/chat", icon: MessageCircle },
  { label: "Auditions", href: "/auditions", icon: Monitor },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Settings", href: "/settings", icon: Settings },
]

interface ChatSidebarProps {
  session: DNASession | null;
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
}

/**
 * ChatSidebar Component
 * Renders the chat interface sidebar with session info, DNA sections navigation,
 * progress bar, menu items, and premium plan upgrade section.
 * @param session - The current DNA session data or null
 * @param activeSection - The ID of the currently active DNA section
 * @param onSectionClick - Callback when a DNA section is clicked
 */
export function ChatSidebar({
  session,
  activeSection,
  onSectionClick,
}: ChatSidebarProps) {
  const pathname = usePathname();

  const lastActive = session?.lastActiveAt
    ? new Date(
        (session.lastActiveAt as unknown as { seconds: number }).seconds * 1000
      ).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "February 18, 2026";

  return (
    <aside className="flex w-[220px] shrink-0 flex-col bg-[#3D4A3C] text-[#F5F0E8]">
      {/* Logo */}
      <div className="flex items-center justify-center px-5 pt-6 pb-5">
        {/* We wrap the image in a Link so clicking the logo goes home. 
            Added a slight hover scale effect for interactivity */}
        <Link href="/dashboard" className="block transition-transform hover:scale-105">
          <Image 
            src="/logo.png" 
            alt="The Actors Copilot" 
            width={100} 
            height={100} 
            className="object-contain" // Ensures the image doesn't stretch or distort
            priority // Tells Next.js to load this immediately since it's above the fold
          />
        </Link>
      </div>

      <div className="mx-5 mb-4 border-t border-[#F5F0E8]/10" />

      {/* Session Info */}
      <div className="px-5 pb-2">
        <span className="inline-flex items-center rounded-full bg-[#E8721A] px-3 py-1 text-xs font-semibold text-[#ffffff]">
          Session {session?.sessionNumber ?? 2} of{" "}
          {session?.totalSessions ?? 7}
        </span>
        <h3 className="mt-3 font-title text-base italic leading-snug text-[#E8721A]">
          Continue your discovery
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-[#F5F0E8]/60">
          Last session: {lastActive} &middot;{" "}
          {session?.durationMinutes ?? 18} minutes
        </p>
      </div>

      {/* DNA Sections */}
      <div className="px-5 flex-1 overflow-y-auto custom-scrollbar pb-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Dna className="h-3.5 w-3.5 text-[#F5F0E8]/50" />
          <span className="text-[10px] uppercase tracking-widest text-[#F5F0E8]/50">
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
                    ? "font-medium text-[#E8721A]"
                    : "text-[#F5F0E8]/70 hover:text-[#F5F0E8]"
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
            )
          }
          
          )}
        </nav>
      </div>

      {/* Progress Bar */}
      <div className="px-5 pb-5 flex-shrink-0">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2C3328]">
          <div
            className="h-full rounded-full bg-[#E8721A] transition-all duration-500"
            style={{ width: `${session?.progress ?? 10}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-[#F5F0E8]/60">
          Progress: {session?.progress ?? 10}%
        </p>
      </div>

      {/* Menu */}
      <div className="shrink-0 px-4">
        <p className="mb-2 px-1 text-[10px] uppercase tracking-widest text-[#F5F0E8]/50">
          Menu
        </p>
        <nav className="flex flex-col gap-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#E8721A]/15 text-[#E8721A]"
                    : "text-[#F5F0E8]/70 hover:bg-[#F5F0E8]/5 hover:text-[#F5F0E8]"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Premium Plan */}
      <div className="p-2 pt-1">
        <div className="rounded-xl bg-[#2C3328] p-3">
          <h4 className="font-title text-lg font-bold text-[#F5F0E8]">
            Bussiness Class
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-[#F5F0E8]/50">
            Upgrade to Bussiness Class to unlock more features
          </p>
          <button className="mt-3 w-full rounded-lg bg-[#E8721A] py-2 text-sm font-medium text-[#2C3328] transition-colors hover:bg-[#E8721A]/90">
            Upgrade
          </button>
        </div>
      </div>
    </aside>
  );
}
