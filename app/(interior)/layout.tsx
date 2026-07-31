import { AppSidebar } from "@/components/app-sidebar"
import { MicFab } from "@/components/mic-fab"
import { DashboardFooter } from "@/components/dashboard-footer"
import ProtectedRoute from "@/lib/context/ProtectedRoute"
import { SidebarProvider } from "@/lib/context/SidebarContext"

/**
 * Interior layout component that wraps dashboard pages.
 * Provides authentication protection, sidebar navigation, and microphone FAB.
 * @param props - Component props including children
 * @param props.children - Child components to render within the interior layout
 * @returns The interior layout with protected route and navigation components
 */
export default function InteriorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background transition-colors">

        <ProtectedRoute>
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
            {children}
            <DashboardFooter />
          </div>
          {}

        </ProtectedRoute>

      </div>
    </SidebarProvider>
  )
}
