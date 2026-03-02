import { Dna } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"

export default function PersonalDnaPage() {
  return (
    <main className="flex flex-1 flex-col">
      <DashboardHeader title="Personal DNA" />
      <div className="flex flex-1 flex-col items-center justify-center px-8 pb-16">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3D4A3C]">
          <Dna className="h-9 w-9 text-[#E8721A]" />
        </div>
        <h2 className="mt-6 font-serif text-2xl font-bold text-[#2C3328]">Start Building Your DNA</h2>
        <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-[#6B6B6B]">
          Your Personal DNA Vault captures your emotional anchors, lived experiences, and patterns. Build it through guided conversation to sharpen every audition.
        </p>
        <button className="mt-6 rounded-full bg-[#E8721A] px-8 py-3 text-sm font-medium text-[#2C3328] transition-colors hover:bg-[#E8721A]/90">
          Start Building DNA
        </button>
      </div>
    </main>
  )
}
