"use client"

import { useAuth } from "@/lib/context/AuthContext";
import { useSidebar } from "@/lib/context/SidebarContext";
import { useEffect } from "react";
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import {
  LayoutDashboard,
  MessageCircle,
  Monitor,
  Dna,
  Settings,
  Plus,
  Sparkles,
  LogOut,
  User,
  BookOpen,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Personal DNA", href: "/chat", icon: MessageCircle },
  { label: "Acting Coach", href: "/acting-coach", icon: BookOpen },
  { label: "Auditions", href: "/auditions", icon: Monitor },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Settings", href: "/settings", icon: Settings },
]

/**
 * AppSidebar Component
 * Renders the main application sidebar with logo, quick actions, navigation menu,
 * and premium plan upgrade section. Includes logout functionality.
 */
export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter();
  const {logout} = useAuth();
  const { isOpen, setIsOpen } = useSidebar();
  const isChatPage = pathname.includes('/chat');

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname, setIsOpen]);

  /**
   * Handles user logout by calling the logout function from AuthContext.
   */
  const handleLogout = async ()=> {
    await logout();
  }

  return (
    <>
      {/* Backdrop (mobile only, when open) */}
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
          "fixed inset-y-0 left-0 z-40 flex h-full w-[220px] transform flex-col bg-[#3D4A3C] text-[#F5F0E8] shadow-xl transition-transform duration-200",
          "md:relative md:z-auto md:h-screen md:translate-x-0 md:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close menu"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[#F5F0E8]/70 transition-colors hover:bg-[#F5F0E8]/10 hover:text-[#F5F0E8] md:hidden"
        >
          <X className="h-4 w-4" />
        </button>

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

      {/* Quick Actions */}
      <div className="px-4 pb-4">
        <p className="mb-2 px-1 text-[10px] uppercase tracking-widest text-[#F5F0E8]/50">
          Quick Actions
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/chat"
            className="flex items-center gap-2 rounded-lg border border-[#F5F0E8]/20 bg-[#F5F0E8]/10 px-4 py-2.5 text-sm font-medium text-[#F5F0E8] transition-colors hover:bg-[#F5F0E8]/15"
          >
            <Sparkles className="h-4 w-4" />
            New DNA Session
          </Link>
          <Link
            href="/auditions/new/sides"
            className="flex items-center gap-2 rounded-lg bg-[#E8721A] px-4 py-2.5 text-sm font-medium text-[#2C3328] transition-colors hover:bg-[#E8721A]/90"
          >
            <Plus className="h-4 w-4" />
            New Audition
          </Link>
          <Link
            href="/auditions/new/brief"
            className="flex items-center gap-2 rounded-lg bg-[#E8721A] px-4 py-2.5 text-sm font-medium text-[#2C3328] transition-colors hover:bg-[#E8721A]/90"
          >
            <Plus className="h-4 w-4" />
            Brief Breakdown
          </Link>
          
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
          <button 
          onClick={logout}
          className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                     "text-[#F5F0E8]/70 hover:bg-[#F5F0E8]/5 hover:text-[#F5F0E8]"
                )}
          >
          <LogOut className="h-5 w-5" /> 
          <span className="">Logout</span> 
        </button>
        </nav>
      </div>

      

      {/* Premium Plan */}
      <div className="p-4">
        <div className="rounded-xl bg-[#2C3328] p-4">
          <h4 className="font-title text-lg font-bold text-[#F5F0E8]">Bussiness Class</h4>
          <p className="mt-1 text-xs leading-relaxed text-[#F5F0E8]/50">
            Upgrade to Bussiness Class to unlock more features
          </p>
          <a 
            href="https://the-actors-copilot.mykajabi.com/offers/92T6p3kD/checkout" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-3 block w-full text-center rounded-lg bg-[#ECD4B3] py-2.5 text-sm font-medium text-[#2C3328] transition-colors hover:bg-[#E8721A]/90"
          >
            Upgrade
          </a>
        </div>
      </div>
      </aside>
    </>
  )
}
