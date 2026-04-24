"use client"

import { useAuth } from "@/lib/context/AuthContext";
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
  const isChatPage = pathname.includes('/chat');

  /**
   * Handles user logout by calling the logout function from AuthContext.
   */
  const handleLogout = async ()=> {
    await logout();
  }

  return (
    <aside className="w-[220px] h-screen flex flex-col bg-[#3D4A3C] text-[#F5F0E8]">
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
          <h4 className="font-title text-lg font-bold text-[#F5F0E8]">Premium Plan</h4>
          <p className="mt-1 text-xs leading-relaxed text-[#F5F0E8]/50">
            Upgrade to Premium Plan to unlock more features
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
  )
}
