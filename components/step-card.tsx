import type { LucideIcon } from "lucide-react"

interface StepCardProps {
  stepNumber: number
  title: string
  description: string
  ctaLabel: string
  ctaIcon: LucideIcon
  variant: "olive" | "orange"
  bodyVariant?: "dark" | "sage"
}

export function StepCard({
  stepNumber,
  title,
  description,
  ctaLabel,
  ctaIcon: Icon,
  variant,
  bodyVariant = "dark",
}: StepCardProps) {
  const headerBg = variant === "olive" ? "bg-[#3D4A3C]" : "bg-[#E8721A]"
  const headerText = variant === "olive" ? "text-[#F5F0E8]" : "text-[#2C3328]"

  const bodyBg = bodyVariant === "sage" ? "bg-[#D4DDD6]" : "bg-[#4A5548]"
  const bodyText = bodyVariant === "sage" ? "text-[#2C3328]" : "text-[#F5F0E8]/85"

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl">
      {/* Header */}
      <div className={`${headerBg} px-6 py-5 text-center`}>
        <p className={`text-sm font-semibold uppercase tracking-wide ${headerText}`}>
          Step {stepNumber}
        </p>
        <h3 className={`mt-1 font-serif text-xl font-bold ${headerText}`}>{title}</h3>
      </div>

      {/* Body */}
      <div className={`${bodyBg} flex flex-1 flex-col px-6 py-8`}>
        <p className={`flex-1 text-center text-sm leading-relaxed ${bodyText}`}>
          {description}
        </p>

        {/* CTA Button */}
        <button className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-[#2C3328]/15 bg-[#F5F0E8] px-6 py-3 text-sm font-medium text-[#2C3328] transition-colors hover:bg-[#E8DFD0]">
          <Icon className="h-4 w-4" />
          {ctaLabel}
        </button>
      </div>
    </div>
  )
}
