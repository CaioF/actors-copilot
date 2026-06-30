"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  MessageCircle,
  Monitor,
  Dna,
  Settings,
  CheckCircle2,
  User,
  BookOpen,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DNA_SECTIONS, ARENA_THEMES, THEME_DISPLAY_NAMES } from "@/lib/chat-types";
import type { DNASession, DNASectionId } from "@/lib/chat-types";
import { useState, useMemo, useEffect } from "react";
import { useSidebar } from "@/lib/context/SidebarContext";
import { useAuth } from "@/lib/context/AuthContext";

interface SectionProgressRingProps {
  current: number;
  total: number;
  isCompleted: boolean;
  sectionId: DNASectionId;
  themesCovered?: string[];
}

/**
 * Standard Firebase Timestamp interface representation.
 */
interface FirebaseTimestamp {
  seconds: number;
  nanoseconds?: number;
}

/**
 * Type guard to safely identify a Firebase Timestamp object at runtime.
 * Eliminates the need for 'any' or forced assertions.
 *
 * @param {unknown} value - The runtime object value under test.
 * @returns {value is FirebaseTimestamp} Boolean indicating contract match.
 */
const isFirebaseTimestamp = (value: unknown): value is FirebaseTimestamp => {
  return (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as Record<string, unknown>).seconds === "number"
  );
};

/**
 * Normalizes mixed date payloads (Firebase Timestamps, ISO strings, JS Dates) 
 * into a safe, native JavaScript Date object.
 *
 * @param {unknown} dateValue - The incoming polymorphic date variant.
 * @returns {Date | null} Parsed deterministic JavaScript Date object or null.
 */
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
 *
 * @component
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
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Personal DNA", href: "/chat", icon: MessageCircle },
  { label: "Acting Coach", href: "/acting-coach", icon: BookOpen },
  { label: "Auditions", href: "/auditions", icon: Monitor },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface ChatSidebarProps {
  session: DNASession | null;
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
}

/**
 * ChatSidebar Component.
 * Renders the chat interface navigation layer with responsive side constraints,
 * synchronizing state with user subscription entitlements native to Stripe.
 *
 * @component
 * @param {ChatSidebarProps} props - The operational layout properties.
 * @returns {JSX.Element} Extended operational sidebar layout wrapper.
 */
export function ChatSidebar({
  session,
  activeSection,
  onSectionClick,
}: ChatSidebarProps) {
  const pathname = usePathname();
  const { isOpen, setIsOpen } = useSidebar();
  const { user, loading } = useAuth();
  const [billingLoading, setBillingLoading] = useState<boolean>(false);

  /**
   * Evaluates corporate entitlement tier metrics native to the modern Stripe ecosystem.
   */
  const isBusinessClass = user?.tier === 'business';

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

  /**
   * Dispatches asynchronous secure routing configurations. Sets dynamic parameters 
   * to either invoke Stripe Hosted Checkout sessions or the customer self-service portal.
   *
   * @async
   * @throws {Error} Logs underlying operational failure states within the network stream.
   * @returns {Promise<void>}
   */
  const handleBillingAction = async (): Promise<void> => {
    if (billingLoading) return;
    setBillingLoading(true);

    try {
      const endpoint = isBusinessClass ? '/api/billing/portal' : '/api/billing/checkout';
      const body = isBusinessClass ? undefined : JSON.stringify({ tier: 'business' });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const data = await response.json();

      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        console.error('❌ Billing operational endpoint transition failed:', data.error);
      }
    } catch (err) {
      console.error('❌ Fatal error dispatching frontend billing redirect sequence:', err);
    } finally {
      setBillingLoading(false);
    }
  };

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
          "fixed inset-y-0 left-0 z-40 flex h-full w-[220px] transform flex-col overflow-y-auto bg-[#3D4A3C] text-[#F5F0E8] shadow-xl transition-transform duration-200",
          "md:relative md:z-auto md:h-auto md:w-[220px] md:shrink-0 md:translate-x-0 md:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close menu"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[#F5F0E8]/70 transition-colors hover:bg-[#F5F0E8]/10 hover:text-[#F5F0E8] md:hidden"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center justify-center px-5 pt-6 pb-5">
          <Link href="/dashboard" className="block transition-transform hover:scale-105">
            <Image
              src="/logo.png"
              alt="The Actors Copilot"
              width={100}
              height={100}
              className="object-contain"
              priority
            />
          </Link>
        </div>

        <div className="mx-5 mb-4 border-t border-[#F5F0E8]/10" />

        <div className="px-5 pb-2">
          <h3 className="mt-3 font-title text-base italic leading-snug text-[#E8721A]">
            Continue your discovery
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-[#F5F0E8]/60">
            Last session: {formattedLastActive} 
          </p>
        </div>

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
              );
            })}
          </nav>
        </div>

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

        {!loading && (
          <div className="p-4 mt-auto">
            <div className="rounded-xl bg-[#2C3328] p-4">
              <h4 className="font-title text-lg font-bold text-[#F5F0E8]">
                {isBusinessClass ? "Premium Account" : "Business Class"}
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-[#F5F0E8]/50">
                {isBusinessClass 
                  ? "Manage your account, billing details, and invoices in the secure customer portal." 
                  : "Upgrade to Business Class for the full coaching and profile analysis experience."}
              </p>
              <button 
                onClick={handleBillingAction}
                disabled={billingLoading}
                className={cn(
                  "mt-3 block w-full text-center rounded-lg bg-[#ECD4B3] py-2.5 text-sm font-medium text-[#2C3328] transition-all hover:bg-[#E8721A] hover:text-white active:scale-95 disabled:opacity-50",
                  billingLoading && "cursor-wait"
                )}
              >
                {billingLoading ? "Loading..." : isBusinessClass ? "Manage Subscription" : "Upgrade"}
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}