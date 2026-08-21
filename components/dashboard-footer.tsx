import { Lock, Trash2, Shield } from "lucide-react"

/**
 * DashboardFooter Component
 * Displays security and privacy messaging footer with icons for NDA Safe, Delete Anytime, and Private By Default.
 */
export function DashboardFooter() {
  return (
    <footer className="shrink-0 flex flex-wrap items-center justify-center gap-6 px-8 py-6 text-xs text-muted-foreground transition-colors border-t border-border/30 mt-auto">
      <div className="flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5 text-primary/70" />
        <span>NDA Safe</span>
      </div>
      <span className="text-border">|</span>
      <div className="flex items-center gap-1.5">
        <Trash2 className="h-3.5 w-3.5 text-primary/70" />
        <span>Delete Anytime</span>
      </div>
      <span className="text-border">|</span>
      <div className="flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5 text-primary/70" />
        <span>Private By Default</span>
      </div>
    </footer>
  )
}
