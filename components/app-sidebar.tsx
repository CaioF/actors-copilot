"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useSidebar } from "@/lib/context/SidebarContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
];

/**
 * AppSidebar Component.
 * Serves as the primary global application navigation drawer structure.
 * Integrates asynchronously with modern Stripe entitlements to switch billing interfaces.
 *
 * @component
 * @returns {JSX.Element} The rendered global sidebar layer.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user, loading } = useAuth();
  const { isOpen, setIsOpen } = useSidebar();
  const [billingLoading, setBillingLoading] = useState<boolean>(false);

  /**
   * Evaluates corporate entitlement tier metrics native to the modern Stripe ecosystem.
   */
  const isBusinessClass = user?.tier === "business";

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[Sidebar Auth Trace]:", {
        isLoading: loading,
        hasUser: !!user,
        currentTier: user?.tier || "free",
        isBusinessClassResolved: isBusinessClass,
      });
    }
  }, [user, loading, isBusinessClass]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname, setIsOpen]);

  /**
   * Invokes the authentication provider's logout protocol.
   *
   * @async
   * @returns {Promise<void>}
   */
  const handleLogout = async (): Promise<void> => {
    await logout();
  };

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
      const endpoint = isBusinessClass ? "/api/billing/portal" : "/api/billing/checkout";
      const body = isBusinessClass ? undefined : JSON.stringify({ tier: "business" });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const data = await response.json();

      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        console.error("Billing operational endpoint transition failed:", data.error);
      }
    } catch (err) {
      console.error("Fatal error dispatching frontend billing redirect sequence:", err);
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
          "fixed inset-y-0 left-0 z-40 flex h-full w-55 transform flex-col bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 dark:text-sidebar-foreground",
          "md:relative md:z-auto md:h-screen md:translate-x-0 md:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close menu"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"
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

        <div className="px-4 pb-4">
          <p className="mb-2 px-1 text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
            Quick Actions
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/auditions/new/brief"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Audition Breakdown
            </Link>
            <Link
              href="/auditions/new/sides"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Scene Study
            </Link>
          </div>
        </div> 

        <div className="flex-1 px-4">
          <p className="mb-2 px-1 text-[10px] uppercase tracking-widest text-[#F5F0E8]/50">
            Menu
          </p>
          <nav className="flex flex-col gap-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            
            <button 
              onClick={handleLogout}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <LogOut className="h-5 w-5" /> 
              <span>Logout</span> 
            </button>
          </nav>
        </div>

        
      </aside>
    </>
  );
}