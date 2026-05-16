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
  Settings,
  Plus,
  LogOut,
  User,
  BookOpen,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Navigation schema definition.
 * Centralized configuration for the primary sidebar routing elements.
 */
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
 * * Serves as the primary navigation layout for the application.
 * Integrates directly with AuthContext for session state and SidebarContext 
 * for responsive mobile drawer management.
 */
export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter();
  const { logout, user, loading } = useAuth();
  const { isOpen, setIsOpen } = useSidebar();

  /**
   * Enterprise Tier Validation
   * Resolves the required product identifier from environment variables to prevent hardcoding.
   * Evaluates the current user's entitlement payload to determine premium access state.
   */
  const businessId = process.env.NEXT_PUBLIC_KAJABI_BUSINESS_ID || "";
  const isBusinessClass = !!(user?.offers?.includes(businessId));


/**
 * Technical Debugging Telemetry
 * Temporary execution trace to inspect the authentication payload and environmental variables.
 * Inspect this in your browser's Developer Tools (F12) console.
 */
useEffect(() => {
  if (process.env.NODE_ENV === "development") {
    console.log("[Sidebar Auth Trace]:", {
      isLoading: loading,
      hasUser: !!user,
      userOffers: user?.offers || [],
      expectedBusinessId: businessId,
      isBusinessClassResolved: isBusinessClass
    });
  }
}, [user, loading, businessId, isBusinessClass]);

  /**
   * Route Transition Listener
   * Automatically dismisses the mobile navigation drawer upon successful route navigation
   * to prevent state staleness and improve mobile UX flow.
   */
  useEffect(() => {
    setIsOpen(false);
  }, [pathname, setIsOpen]);

  /**
   * Session Termination Handler
   * Invokes the authentication provider's logout protocol.
   */
  const handleLogout = async () => {
    await logout();
  }

  return (
    <>
      {/* Mobile Overlay: Focus trap and backdrop dismissal for drawer UI */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}

      {/* Primary Sidebar Navigation Container */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-[220px] transform flex-col bg-[#3D4A3C] text-[#F5F0E8] shadow-xl transition-transform duration-200",
          "md:relative md:z-auto md:h-screen md:translate-x-0 md:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Mobile Dismiss Action */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close menu"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[#F5F0E8]/70 transition-colors hover:bg-[#F5F0E8]/10 hover:text-[#F5F0E8] md:hidden"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Branding & Root Navigation Anchor */}
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

        {/* Primary Action Buttons (Workflow Triggers) */} 
        <div className="px-4 pb-4">
          <p className="mb-2 px-1 text-[10px] uppercase tracking-widest text-[#F5F0E8]/50">
            Quick Actions
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/auditions/new/brief"
              className="flex items-center gap-2 rounded-lg bg-[#E8721A] px-4 py-2.5 text-sm font-medium text-[#2C3328] transition-colors hover:bg-[#E8721A]/90"
            >
              <Plus className="h-4 w-4" />
              Audition Breakdown
            </Link>
            <Link
              href="/auditions/new/sides"
              className="flex items-center gap-2 rounded-lg bg-[#E8721A] px-4 py-2.5 text-sm font-medium text-[#2C3328] transition-colors hover:bg-[#E8721A]/90"
            >
              <Plus className="h-4 w-4" />
              Scene Study
            </Link>
          </div>
        </div> 

        {/* Global Navigation Matrix */}
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
            
            {/* Session Termination Action */}
            <button 
              onClick={handleLogout}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                "text-[#F5F0E8]/70 hover:bg-[#F5F0E8]/5 hover:text-[#F5F0E8]"
              )}
            >
              <LogOut className="h-5 w-5" /> 
              <span>Logout</span> 
            </button>
          </nav>
        </div>

        {/* * Tier-Based Upsell Section
 * Conditionally rendered strictly for standard-tier users once authentication loading settles.
 * Suppressed automatically if 'Business Class' entitlement is resolved in user payload.
 */}

{!loading && !isBusinessClass && (
  <div className="p-4">
    <div className="rounded-xl bg-[#2C3328] p-4">
      <h4 className="font-title text-lg font-bold text-[#F5F0E8]">Business Class</h4>
      <p className="mt-1 text-xs leading-relaxed text-[#F5F0E8]/50">
        Upgrade to Business Class to unlock more features
      </p>
      <a 
        href="https://the-actors-copilot.mykajabi.com/offers/92T6p3kD/checkout?coupon_code=UPGRADEBUSINESS" 
        target="_blank" 
        rel="noopener noreferrer"
        className="mt-3 block w-full text-center rounded-lg bg-[#ECD4B3] py-2.5 text-sm font-medium text-[#2C3328] transition-colors hover:bg-[#E8721A]/90"
      >
        Upgrade
      </a>
    </div>
  </div>
)}
      </aside>
    </>
  )
}