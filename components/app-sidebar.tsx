"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  MessageCircle,
  Monitor,
  Dna,
  Settings,
  Plus,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Chat", href: "/chat", icon: MessageCircle },
  { label: "Auditions", href: "/auditions", icon: Monitor },
  { label: "Personal DNA", href: "/personal-dna", icon: Dna },
  { label: "Settings", href: "/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-[220px] shrink-0 flex-col bg-[#3D4A3C] text-[#F5F0E8]">
      {/* Logo */}
      <div className="flex items-center justify-center px-5 pt-6 pb-5">
        <div className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-md border border-[#F5F0E8]/20 bg-[#2C3328]">
          <span className="text-[7px] font-medium uppercase tracking-widest text-[#F5F0E8]/70">The</span>
          <span className="font-sans text-[15px] font-extrabold uppercase leading-none tracking-wide text-[#F5F0E8]">Actors</span>
          <span className="text-[7px] font-medium uppercase tracking-widest text-[#F5F0E8]/70">Copilot</span>
          <span className="mt-0.5 text-[6px] text-[#E8721A]">&#9733;</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 pb-4">
        <p className="mb-2 px-1 text-[10px] uppercase tracking-widest text-[#F5F0E8]/50">
          Quick Actions
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/auditions"
            className="flex items-center gap-2 rounded-lg bg-[#E8721A] px-4 py-2.5 text-sm font-medium text-[#2C3328] transition-colors hover:bg-[#E8721A]/90"
          >
            <Plus className="h-4 w-4" />
            New Audition
          </Link>
          <button className="flex items-center gap-2 rounded-lg border border-[#F5F0E8]/20 bg-[#F5F0E8]/10 px-4 py-2.5 text-sm font-medium text-[#F5F0E8] transition-colors hover:bg-[#F5F0E8]/15">
            <Sparkles className="h-4 w-4" />
            New Session
          </button>
        </div>
      </div>

      {/* Menu */}
      <div className="flex-1 px-4">
        <p className="mb-2 px-1 text-[10px] uppercase tracking-widest text-[#F5F0E8]/50">
          Menu
        </p>
        <nav className="flex flex-col gap-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
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
            )
          })}
        </nav>
      </div>

      {/* Premium Plan */}
      <div className="p-4">
        <div className="rounded-xl bg-[#2C3328] p-4">
          <h4 className="font-serif text-lg font-bold text-[#F5F0E8]">Premium Plan</h4>
          <p className="mt-1 text-xs leading-relaxed text-[#F5F0E8]/50">
            Upgrade to Premium Plan to unlock more features
          </p>
          <button className="mt-3 w-full rounded-lg bg-[#E8721A] py-2.5 text-sm font-medium text-[#2C3328] transition-colors hover:bg-[#E8721A]/90">
            Upgrade
          </button>
        </div>
      </div>
    </aside>
  )
}
