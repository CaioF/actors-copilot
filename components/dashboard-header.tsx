'use client'

import { useState, useEffect } from "react";
import { Menu, Settings, Mail, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import Link from "next/link";
import { useSidebar } from "@/lib/context/SidebarContext";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  title?: string
  /** Optional custom title element. When provided, replaces the default <h1>{title}</h1>. */
  titleSlot?: React.ReactNode
  className?: string
}

/**
 * DashboardHeader Component
 * Displays the page title and authenticated user's profile.
 * Listens to Firebase Auth state to dynamically update user info.
 * @param title - Optional page title, defaults to "My Self Tape Copilot"
 * @param titleSlot - Optional custom node rendered in place of the title
 * @param className - Optional custom CSS classes to override default layout styling
 */
export function DashboardHeader({ title = "My Self Tape Copilot", titleSlot, className }: DashboardHeaderProps) {
  const { setIsOpen } = useSidebar();

  const [user, setUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  const displayName = user?.displayName || "Actor";
  const firstName = displayName.split(" ")[0];

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <header className={cn("flex bg-card items-center justify-between gap-3 px-4 sm:px-8 mb-10 py-6 transition-colors", className)}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted/70 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            {titleSlot ?? (
              <h1 className="truncate font-title text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
            )}
          </div>
        </div>

        {/* Grupo de Ações do Canto Direito */}
        <div className="flex items-center gap-3">
          {/* 2. Toggle de Tema Adicionado Aqui */}
          <ThemeToggle />

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Support"
          >
            <Mail className="h-5 w-5" />
          </button>

          <Link href={"/settings"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>

          <Link href={"/profile"} className="flex items-center gap-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.photoURL || ""} alt={displayName} />
              <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground">
              {user ? firstName : "Loading..."}
            </span>
          </Link>
        </div>
      </header>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl bg-popover p-6 shadow-xl border border-border text-popover-foreground transition-colors">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="mb-2 font-title text-xl font-bold text-foreground">Need Help?</h2>
            <p className="text-sm text-secondary text-opacity-90">
              Mail to: {" "}
              <a
                href="mailto:support@theactorscopilot.com"
                className="font-medium text-primary transition-colors hover:text-destructive hover:underline"
              >
                support@theactorscopilot.com
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  )
}