import { AppSidebar } from "@/components/app-sidebar"
import { MicFab } from "@/components/mic-fab"
import { DashboardFooter } from "@/components/dashboard-footer"
import ProtectedRoute from "@/lib/context/ProtectedRoute"

export default function InteriorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-[#F0E8DC]">
      <AppSidebar />
      <ProtectedRoute>
        <div className="flex flex-1 flex-col overflow-y-auto">
          {children}
          <DashboardFooter />
        </div>
        <MicFab />
      </ProtectedRoute>
      
    </div>
  )
}
