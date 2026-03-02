import { Lock, Trash2, Shield } from "lucide-react"

export function DashboardFooter() {
  return (
    <footer className="mt-auto flex items-center justify-center gap-6 px-8 py-5 text-xs text-[#6B6B6B]">
      <div className="flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5" />
        <span>NDA Safe</span>
      </div>
      <span className="text-[#C7C0B5]">|</span>
      <div className="flex items-center gap-1.5">
        <Trash2 className="h-3.5 w-3.5" />
        <span>Delete Anytime</span>
      </div>
      <span className="text-[#C7C0B5]">|</span>
      <div className="flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5" />
        <span>Private By Default</span>
      </div>
    </footer>
  )
}
