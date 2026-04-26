'use client'

import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import Link from "next/link";

interface DashboardHeaderProps {
  title?: string
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
 */
export function DashboardHeader({ title = "My Self Tape Copilot" }: DashboardHeaderProps) {

  // We initialize the state as null because when the page loads, 
  // we don't know yet if the user is logged in.
  const [user, setUser] = useState<User | null>(null);

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
    <header className="flex bg-[#8BA2A8] items-center justify-between px-8 mb-10 py-6">
      <h1 className="font-title text-3xl font-bold text-[#2C3328]">{title}</h1>
      <div className="flex items-center gap-3">
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
  )
}
