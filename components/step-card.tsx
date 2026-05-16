import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { ReactNode } from "react"

interface StepCardProps {
  stepNumber: number
  title: string
  description: ReactNode
  link: string
  ctaLabel: string
  ctaIcon: LucideIcon
  variant: "olive" | "orange"
  bodyVariant?: "dark" | "sage"
}

/**
 * A card component that displays a step in a multi-step process or guide.
 */
export function StepCard({
  stepNumber,
  title,
  description,
  link,
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
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl shadow-lg border border-[#B7BCB6]/10">
      {/* Header */}
      <div className={`${headerBg} px-6 py-5 text-center`}>
        {stepNumber === 1 && (
          <p className={`text-sm font-semibold uppercase tracking-wide ${headerText}`}>
            Start here
          </p>
        )}
        {stepNumber === 2 && (
          <p className={`text-sm font-semibold uppercase tracking-wide ${headerText}`}>
            FULL AUDITION
          </p>
        )}
        {stepNumber === 3 && (
          <p className={`text-sm font-semibold uppercase tracking-wide ${headerText}`}>
            INDEPENDENT STUDY
          </p>
        )}
        <h3 className={`mt-1 font-title text-xl font-bold ${headerText}`}>{title}</h3>
      </div>

      {/* Body */}
      <div className={`${bodyBg} flex flex-1 flex-col px-6 py-8`}>
        
        <div className={`text-left text-sm leading-relaxed ${bodyText}`}>
          {description}
        </div>

        <div className="flex-grow min-h-6" />

        {/* CTA Button - Agora fixo no fundo. */}
        <Link href={link}
           className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-[#2C3328]/15 bg-[#F5F0E8] px-6 py-3 text-sm font-medium text-[#2C3328] transition-all hover:bg-[#E8DFD0] active:scale-95 text-center shadow-md">
            <Icon className="h-4 w-4" />
            {ctaLabel}
        </Link>
      </div>
    </div>
  )
}