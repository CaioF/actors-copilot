"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageCircle,
  Monitor,
  Dna,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DNA_SECTIONS } from "@/lib/chat-types";
import type { DNASession } from "@/lib/chat-types";

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Chat", href: "/chat", icon: MessageCircle },
  { label: "Auditions", href: "/auditions", icon: Monitor },
  { label: "Personal DNA", href: "/personal-dna", icon: Dna },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface ChatSidebarProps {
  session: DNASession | null;
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
}

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
      <div className="flex items-center justify-center px-5 pt-6 pb-4">
        <div className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-md border border-[#F5F0E8]/20 bg-[#2C3328]">
          <span className="text-[7px] font-medium uppercase tracking-widest text-[#F5F0E8]/70">
            The
          </span>
          <span className="font-sans text-[15px] font-extrabold uppercase leading-none tracking-wide text-[#F5F0E8]">
            Actors
          </span>
          <span className="text-[7px] font-medium uppercase tracking-widest text-[#F5F0E8]/70">
            Copilot
          </span>
          <span className="mt-0.5 text-[6px] text-[#E8721A]">&#9733;</span>
        </div>
      </div>

      <div className="mx-5 mb-4 border-t border-[#F5F0E8]/10" />

      {/* Session Info */}
      <div className="px-5 pb-4">
        <span className="inline-flex items-center rounded-full bg-[#E8721A] px-3 py-1 text-xs font-semibold text-[#ffffff]">
          Session {session?.sessionNumber ?? 2} of{" "}
          {session?.totalSessions ?? 7}
        </span>
        <h3 className="mt-3 font-serif text-base italic leading-snug text-[#E8721A]">
          Continue your discovery
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-[#F5F0E8]/60">
          Last session: {lastActive} &middot;{" "}
          {session?.durationMinutes ?? 18} minutes
        </p>
      </div>

      {/* DNA Sections */}
      <div className="px-5 pb-3">
        <div className="mb-2 flex items-center gap-1.5">
          <Dna className="h-3.5 w-3.5 text-[#F5F0E8]/50" />
          <span className="text-[10px] uppercase tracking-widest text-[#F5F0E8]/50">
            DNA Sections
          </span>
        </div>
        <nav className="flex flex-col gap-0.5 pl-1">
          {DNA_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => onSectionClick(section.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                activeSection === section.id
                  ? "font-medium text-[#E8721A]"
                  : "text-[#F5F0E8]/70 hover:text-[#F5F0E8]"
              )}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Progress Bar */}
      <div className="px-5 pb-5">
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
      <div className="flex-1 px-4">
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
      <div className="p-4">
        <div className="rounded-xl bg-[#2C3328] p-4">
          <h4 className="font-serif text-lg font-bold text-[#F5F0E8]">
            Premium Plan
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-[#F5F0E8]/50">
            Upgrade to Premium Plan to unlock more features
          </p>
          <button className="mt-3 w-full rounded-lg bg-[#E8721A] py-2.5 text-sm font-medium text-[#2C3328] transition-colors hover:bg-[#E8721A]/90">
            Upgrade
          </button>
        </div>
      </div>
    </aside>
  );
}
