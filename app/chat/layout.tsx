import { SidebarProvider } from "@/lib/context/SidebarContext";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>;
}
