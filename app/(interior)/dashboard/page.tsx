import { Dna, Monitor, Sparkles } from "lucide-react"
import { DashboardHeader } from "@/components/dashboard-header"
import { StepCard } from "@/components/step-card"
import { MemoryRecordingBanner } from "@/components/memory-recording-banner"

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col">
      <DashboardHeader title="My Self Tape Copilot" />

      {/* Step Cards */}
      <div className="flex gap-6 px-8 pb-4">
        <StepCard
          stepNumber={1}
          title="Personal DNA Upload"
          description="Build the foundation of your craft. Through guided conversation, the Copilot learns your emotional anchors, lived experiences, strengths, and patterns — creating a Personal DNA Vault that makes your choices specific and truthful. This is not about oversharing. It's about identifying what's usable. The more you invest here, the sharper your auditions become."
          ctaLabel="Start building DNA"
          ctaIcon={Dna}
          variant="olive"
          bodyVariant="dark"
        />
        <StepCard
          stepNumber={2}
          title="Audition Sides Upload"
          description="Upload your sides and generate a clear, playable breakdown in minutes. The Copilot maps the role to your Personal DNA — producing grounded objectives, stakes, beats, turns, and tactics tailored to you. No guesswork. No spiraling. Just direction you can act on."
          ctaLabel="Start New Audition"
          ctaIcon={Monitor}
          variant="orange"
          bodyVariant="dark"
        />
        <StepCard
          stepNumber={3}
          title="Casting Brief Upload"
          description="Upload the casting brief and the Copilot extracts every requirement: director/casting/producer context, tone references, and a clean checklist for framing, file size, naming, slate/ident, upload link, and deadline — so you don't miss details that cost you trust."
          ctaLabel="Upload Character Brief"
          ctaIcon={Sparkles}
          variant="orange"
          bodyVariant="sage"
        />
      </div>

      {/* Memory Recording Banner */}
      <MemoryRecordingBanner />
    </main>
  )
}
