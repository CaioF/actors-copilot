"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface SidebarContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <SidebarContext.Provider
      value={{ isOpen, setIsOpen, toggle: () => setIsOpen((v) => !v) }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  // Tolerate use outside the provider so isolated component tests don't need to wrap.
  if (!ctx) {
    return { isOpen: false, setIsOpen: () => {}, toggle: () => {} };
  }
  return ctx;
}
