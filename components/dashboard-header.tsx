import { HelpCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface DashboardHeaderProps {
  title?: string
}

export function DashboardHeader({ title = "My Self Tape Copilot" }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between px-8 py-5">
      <h1 className="font-serif text-2xl font-bold text-[#2C3328]">{title}</h1>
      <div className="flex items-center gap-3">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#C7C0B5] text-[#6B6B6B] transition-colors hover:bg-[#E8DFD0]"
          aria-label="Help"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Avatar className="h-9 w-9">
            <AvatarImage src="/placeholder.svg?height=36&width=36" alt="Alex Sinclair" />
            <AvatarFallback className="bg-[#4A5548] text-[#F5F0E8] text-xs">AS</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-[#2C3328]">Alex Sinclair</span>
        </div>
      </div>
    </header>
  )
}
