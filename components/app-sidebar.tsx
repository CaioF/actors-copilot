"use client";

import { useAuth } from "@/lib/context/AuthContext";
import { useSidebar } from "@/lib/context/SidebarContext";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  Home,
  Sparkles,
  BookOpen,
  Mic,
  User,
  Dna,
  Star,
  Moon,
  HelpCircle,
  Settings,
  LogOut,
  ChevronRight,
  Plus,
  X,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Menu principal do topo (baseado no design)
const mainMenuItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Personal DNA", href: "/chat", icon: Sparkles },
  { label: "Acting Coach", href: "/acting-coach", icon: BookOpen },
  { label: "Auditions", href: "/auditions", icon: Mic },
  { label: "Profile", href: "/profile", icon: User },
  { label: "DNA Vault", href: "/dna-vault", icon: Dna },
];

// Menu inferior (baseado no design)
const bottomMenuItems = [
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const { isOpen, setIsOpen } = useSidebar();

  const isBusinessClass = user?.tier === "business";

  useEffect(() => {
    setIsOpen(false);
  }, [pathname, setIsOpen]);

  const handleLogout = async (): Promise<void> => {
    await logout();
  };

  /**
   * Redireciona o usuário para a página de upgrade do plano.
   */
  const handleBillingAction = (): void => {
    router.push("/upgrade");
  };

  return (
    <>
      {/* Overlay Mobile */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 transform flex-col bg-[#2A3B31] text-[#E8E6E3] shadow-xl transition-transform duration-200 select-none",
          "md:relative md:z-auto md:h-screen md:translate-x-0 md:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Botão Fechar Mobile */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close menu"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 md:hidden"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Logo Header */}
        <div className="flex items-center justify-center px-6 pt-8 pb-6">
          <Link href="/dashboard" className="block transition-transform hover:scale-105">
            <Image
              src="/logo.png"
              alt="The Actors Copilot"
              width={140}
              height={140}
              className="object-contain"
              priority
            />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-5 scrollbar-none">
          {/* Quick Actions (Mantidas conforme o código original) */}
          <div className="mb-6">
            <p className="mb-3 text-[11px] font-semibold tracking-wider text-white/40 uppercase">
              Quick Actions
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/auditions/new/brief"
                className="flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-white/20"
              >
                <Plus className="h-4 w-4" />
                Audition Breakdown
              </Link>
              <Link
                href="/auditions/new/sides"
                className="flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-white/20"
              >
                <Plus className="h-4 w-4" />
                Scene Study
              </Link>
            </div>
          </div>

          {/* Nav Menu */}
          <div>
            <p className="mb-3 text-[11px] font-semibold tracking-wider text-white/40 uppercase">
              MENU
            </p>
            <nav className="flex flex-col gap-1.5">
              {mainMenuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3.5 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "text-white font-semibold"
                        : "text-white/70 hover:text-white"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Divisor */}
          <div className="my-5 border-t border-white/10" />

          {/* Ações de Plano & Dark Mode */}
          <div className="flex flex-col gap-2">
            {/* Upgrade Plan Button (Redireciona para /upgrade) */}
            <button
              onClick={handleBillingAction}
              className="flex w-full items-center justify-between rounded-xl border border-[#B36B22] bg-[#3B3A2C]/60 px-3.5 py-3 text-sm font-medium text-white transition-all hover:bg-[#3B3A2C]"
            >
              <div className="flex items-center gap-3">
                <Star className="h-4 w-4 text-white shrink-0" />
                <span>{isBusinessClass ? "Manage Plan" : "Upgrade Plan"}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-white/70 shrink-0" />
            </button>

            <a
              href="https://www.skool.com/the-actors-copilot"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3.5 rounded-md px-2 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>Skool Comunity</span>
            </a>
          </div>

          {/* Divisor */}
          <div className="my-5 border-t border-white/10" />

          {/* Suporte, Configurações & Logout */}
          <nav className="flex flex-col gap-1.5 pb-6">
            {bottomMenuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3.5 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "text-white font-semibold"
                      : "text-white/70 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3.5 rounded-md px-2 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Logout</span>
            </button>
          </nav>
        </div>
      </aside>
    </>
  );
}