'use client'

import { useState, useEffect } from "react";
import { Menu, Settings, Mail, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import Link from "next/link";
import { useSidebar } from "@/lib/context/SidebarContext";

interface DashboardHeaderProps {
  title?: string
  /** Optional custom title element. When provided, replaces the default <h1>{title}</h1>. */
  titleSlot?: React.ReactNode
}

/**
 * DashboardHeader Component
 * * This component displays the page title and the authenticated user's profile.
 * It listens to the Firebase Auth state to dynamically update user info.
 */
/**
 * DashboardHeader Component
 * Displays the page title and authenticated user's profile.
 * Listens to Firebase Auth state to dynamically update user info.
 * @param title - Optional page title, defaults to "My Self Tape Copilot"
 * @param titleSlot - Optional custom node rendered in place of the title
 */
export function DashboardHeader({ title = "My Self Tape Copilot", titleSlot }: DashboardHeaderProps) {
  const { setIsOpen } = useSidebar();

  // We initialize the state as null because when the page loads,
  // we don't know yet if the user is logged in.
  const [user, setUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const auth = getAuth();

    // This is an 'Observer'. It stays active and waits for Firebase to
    // confirm the user's identity.
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Once Firebase responds, we save the user object in our state
      setUser(currentUser);
    });

    // We return the unsubscribe function to "clean up" the listener
    // if the user leaves the page, preventing memory leaks.
    return () => unsubscribe();
  }, []);

  // Logic to display the user's first name or a fallback
  const displayName = user?.displayName || "Actor";
  const firstName = displayName.split(" ")[0];

  // Logic to create initials for the AvatarFallback (e.g., "Gabrielli" -> "G")
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <header className="flex bg-[#8BA2A8] items-center justify-between gap-3 px-4 sm:px-8 mb-10 py-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#2C3328] transition-colors hover:bg-[#7A9098] md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            {titleSlot ?? (
              <h1 className="truncate font-title text-2xl font-bold text-[#2C3328] sm:text-3xl">{title}</h1>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#C7C0B5] text-[#6B6B6B] transition-colors hover:bg-[#E8DFD0]"
            aria-label="Support"
          >
            <Mail className="h-5 w-5" />
          </button>
          <Link href={"/settings"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#C7C0B5] text-[#6B6B6B] transition-colors hover:bg-[#E8DFD0]"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link >
          <Link href={"/profile"} className="flex items-center gap-2">
            <Avatar className="h-9 w-9">
              {/* If the user has a Google/Firebase photo, it loads here */}
              <AvatarImage src={user?.photoURL || ""} alt={displayName} />
              {/* Fallback displays the calculated initials if image fails or doesn't exist */}
              <AvatarFallback className="bg-[#4A5548] text-[#F5F0E8] text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-[#2C3328]">
              {user ? firstName : "Loading..."}
            </span>
          </Link>
        </div>
      </header>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl bg-[#F5F0E8] p-6 shadow-xl border border-[#C7C0B5]">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-[#6B6B6B] transition-colors hover:bg-[#E8DFD0] hover:text-[#2C3328]"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="mb-2 font-title text-xl font-bold text-[#2C3328]">Need Help?</h2>
            <p className="text-sm text-[#4A5548]">
              Mail to:{" "}
              <a
                href="mailto:support@theactorscopilot.com"
                className="font-medium text-[#E8721A] transition-colors hover:text-[#C45A3C] hover:underline"
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
