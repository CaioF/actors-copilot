"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Check, Lock, Ticket, Zap } from "lucide-react"
import { redirectTo } from "@/lib/navigate"
import {
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  formatDisplayPrice,
  getAnnualMonthlyEquivalent,
  getDisplayPrice,
  getMaxAnnualSavingsPercent,
  type RequestedCurrency,
  type RequestedPlan,
} from "@/lib/plan-selection"
import type { BillingCycle } from "@/lib/billing"

type ViewState = "loading" | "ready" | "error" | "skipped"

type CurrencySupportMap = Record<
  BillingCycle,
  Record<RequestedPlan, RequestedCurrency[]>
>

interface PlanOption {
  key: RequestedPlan
  badge: string
  description: string
  features: string[]
  featured?: boolean
}

const PLAN_OPTIONS: PlanOption[] = [
  {
    key: "economy",
    badge: "ECONOMY CLASS",
    description: "Perfect for actors expanding their base analytical workflows and audition setups.",
    features: [
      "Access to Personal DNA Extraction chats",
      "Full Audition Breakdown generation features",
      "Multi-step Audition Wizard access",
      "Standard storage metrics limits",
    ],
  },
  {
    key: "business",
    badge: "BUSINESS CLASS",
    featured: true,
    description: "The complete experience offering advanced generative modules and expert system toolsets.",
    features: [
      "Everything included in Economy Class",
      "Exclusive access to the AI Acting Coach",
      "Deep character lens profile analysis modules",
      "Priority processing speeds on document extractions",
      "Full Actor Profile management tools",
    ],
  },
]

const PLAN_LABELS: Record<RequestedPlan, string> = {
  economy: "Economy Class",
  business: "Business Class",
}

const TRIAL_DAYS = 14

/**
 * Trial recovery screen.
 *
 * Shown when an account still owes the activation of its free trial (for
 * example after a server side fault interrupted the first checkout). The page
 * explains what happened, lets the user choose the plan, the billing cycle
 * and the currency, and then hands them over to the Stripe Checkout.
 *
 * @returns The branded recovery and plan selection screen
 */
export default function StartTrialPage() {
  const [view, setView] = useState<ViewState>("loading")
  const [support, setSupport] = useState<CurrencySupportMap | null>(null)
  const [plan, setPlan] = useState<RequestedPlan>("business")
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly")
  const [currency, setCurrency] = useState<RequestedCurrency>(DEFAULT_CURRENCY)
  const [submitting, setSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  // 1. Check whether there is a pending recovery and load the currency map.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [recoveryRes, supportRes] = await Promise.all([
          fetch("/api/billing/recovery", { method: "POST" }),
          fetch("/api/billing/currencies"),
        ])

        const recovery = await recoveryRes.json().catch(() => null)
        const supportData = await supportRes.json().catch(() => null)

        if (cancelled) return

        if (supportData?.support) setSupport(supportData.support as CurrencySupportMap)

        if (!recoveryRes.ok || !recovery?.pending) {
          setView("skipped")
          window.setTimeout(() => redirectTo("/dashboard"), 1200)
          return
        }

        setPlan(recovery.tier === "economy" ? "economy" : "business")
        if (recovery.currency) setCurrency(recovery.currency)

        setView("ready")
      } catch {
        if (!cancelled) setView("error")
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  const priceUnit = billingCycle === "annual" ? "/year" : "/month"
  const annualSavingsPercent = getMaxAnnualSavingsPercent(currency)

  const displayPrice = (candidate: RequestedPlan): string | null => {
    const amount = getDisplayPrice(candidate, currency, billingCycle)
    return amount === null ? null : formatDisplayPrice(amount, currency)
  }

  const annualNote = (candidate: RequestedPlan): string | null => {
    if (billingCycle !== "annual") return null
    const monthlyEquivalent = getAnnualMonthlyEquivalent(candidate, currency)
    if (monthlyEquivalent === null) return null
    return `Billed annually. Equivalent to ${formatDisplayPrice(monthlyEquivalent, currency)}/month.`
  }

  /** Reason why this plan cannot be purchased with the selected currency, if any. */
  const blockedReason = (candidate: RequestedPlan): string | null => {
    if (getDisplayPrice(candidate, currency, billingCycle) === null) {
      return `Not available in ${currency.toUpperCase()}.`
    }
    if (!support) return null
    const available = support[billingCycle]?.[candidate]
    if (!available) return null
    if (!available.includes(currency)) {
      return `${currency.toUpperCase()} is not available for ${PLAN_LABELS[candidate]} yet.`
    }
    return null
  }

  const selectedBlockedReason = blockedReason(plan)
  const selectedPrice = displayPrice(plan)

  const summary = useMemo(() => {
    if (!selectedPrice) return null
    const cycleLabel = billingCycle === "annual" ? "Annual" : "Monthly"
    return `${PLAN_LABELS[plan]} · ${cycleLabel} · ${selectedPrice}${priceUnit}`
  }, [plan, billingCycle, selectedPrice, priceUnit])

  // 2. Open the checkout for the selected plan, cycle and currency.
  const startTrial = async () => {
    if (submitting || selectedBlockedReason) return

    setSubmitting(true)
    setCheckoutError(null)

    try {
      const response = await fetch("/api/billing/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: plan, billingCycle, currency }),
      })

      const data = await response.json()

      if (!response.ok || !data.checkoutUrl) {
        setCheckoutError(data.error || "We could not start the checkout. Please try again.")
        setSubmitting(false)
        return
      }

      redirectTo(data.checkoutUrl)
    } catch {
      setCheckoutError("We could not start the checkout. Please try again.")
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#152323] px-5 py-12">
      {/* Ambient aurora lights, the signature of the landing page */}
      <div
        className="pointer-events-none absolute top-[15%] left-[-15%] h-[600px] w-[600px] rounded-full opacity-40 blur-[120px] md:h-[800px] md:w-[800px]"
        style={{
          background: "radial-gradient(circle, rgba(160, 190, 190, 0.5) 30%, transparent 90%)",
        }}
      />
      <div
        className="pointer-events-none absolute top-[-10%] right-[-10%] h-[700px] w-[700px] rounded-full opacity-50 blur-[130px] md:h-[900px] md:w-[900px]"
        style={{
          background: "radial-gradient(circle, rgba(255, 230, 170, 0.4) 0%, transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute top-[-5%] right-[-5%] h-[300px] w-[400px] rotate-[-15deg] opacity-70 blur-[90px] md:h-[400px] md:w-[500px]"
        style={{
          background: "linear-gradient(135deg, rgba(255, 250, 230, 1) 0%, rgba(255, 210, 140, 0.6) 50%, transparent 100%)",
          borderRadius: "40px",
        }}
      />

      {/* Studio spotlight */}
      <div className="pointer-events-none absolute right-[-25%] top-[0%] z-0 h-screen w-[450px] md:right-[-10%] md:w-[600px]">
        <div
          className="absolute left-[10%] top-[8%] h-75 w-87.5 rotate-[-15deg] opacity-55 blur-[70px] md:top-[12%] md:h-100 md:w-112.5"
          style={{
            background: "linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(255, 230, 180, 0.8) 40%, transparent 100%)",
            borderRadius: "40px",
          }}
        />
        <div className="relative h-full w-full opacity-95">
          <Image src="/spotlight.png" alt="" fill className="object-contain object-top" priority />
        </div>
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-2xl">
        <div className="rounded-[28px] border border-white/10 bg-[#0e1919]/92 px-6 py-8 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:px-9 sm:py-10">
          <div className="flex flex-col items-center text-center">
            <div className="relative h-20 w-20">
              <Image src="/image.png" alt="The Actors Copilot" fill className="object-contain" priority />
            </div>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F2671A]">
              One quick thing
            </p>

            {view === "loading" && (
              <>
                <h1 className="font-title mt-3 text-4xl font-bold leading-[1.05] tracking-tight text-[#EFEADD] sm:text-5xl">
                  Getting your trial ready
                </h1>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-[#EFEADD]/70">
                  One moment — we&apos;re opening our secure checkout.
                </p>
                <div className="mt-7 h-1 w-40 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-[#F2671A]" />
                </div>
              </>
            )}

            {view === "skipped" && (
              <>
                <h1 className="font-title mt-3 text-4xl font-bold leading-[1.05] tracking-tight text-[#EFEADD] sm:text-5xl">
                  You&apos;re all set
                </h1>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-[#EFEADD]/70">
                  Taking you to your dashboard.
                </p>
              </>
            )}

            {view === "error" && (
              <>
                <h1 className="font-title mt-3 text-4xl font-bold leading-[1.05] tracking-tight text-[#EFEADD] sm:text-5xl">
                  We couldn&apos;t open your checkout
                </h1>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-[#EFEADD]/70">
                  Nothing is lost — your trial is still waiting for you. Try once more, or pick a plan from the
                  upgrade page.
                </p>
                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="w-full rounded-full bg-[#F2671A] px-7 py-3.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] sm:w-auto"
                  >
                    Try again
                  </button>
                  <Link
                    href="/upgrade"
                    className="w-full rounded-full border border-white/20 px-7 py-3.5 text-center text-sm font-semibold text-[#EFEADD] transition-all hover:bg-white/10 active:scale-[0.98] sm:w-auto"
                  >
                    See all plans
                  </Link>
                </div>
              </>
            )}

            {view === "ready" && (
              <>
                <h1 className="font-title mt-3 text-4xl font-bold leading-[1.05] tracking-tight text-[#EFEADD] sm:text-5xl">
                  Your <span className="text-[#F2671A]">free trial</span> is ready to start
                </h1>

                <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#EFEADD]/75">
                  A brief delay on our side meant your {TRIAL_DAYS}-day free trial never started. Nothing has been
                  charged, and your account is ready. Pick the plan that fits you and we&apos;ll switch it on.
                </p>

                {/* Billing cycle */}
                <div className="mt-7 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] p-1">
                  {(["monthly", "annual"] as BillingCycle[]).map((cycle) => (
                    <button
                      key={cycle}
                      type="button"
                      onClick={() => setBillingCycle(cycle)}
                      aria-pressed={billingCycle === cycle}
                      className={`rounded-full px-5 py-2 text-xs font-semibold transition-all ${
                        billingCycle === cycle
                          ? "bg-[#F2671A] text-white"
                          : "text-[#EFEADD]/60 hover:text-[#EFEADD]"
                      }`}
                    >
                      {cycle === "monthly" ? "Monthly" : "Annual"}
                      {cycle === "annual" && annualSavingsPercent !== null && (
                        <span className="ml-1.5 opacity-80">Save {annualSavingsPercent}%</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Plan cards */}
                <div className="mt-5 grid gap-4 text-left sm:grid-cols-2">
                  {PLAN_OPTIONS.map((option) => {
                    const isSelected = plan === option.key
                    const price = displayPrice(option.key)
                    const note = annualNote(option.key)
                    const blocked = blockedReason(option.key)

                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setPlan(option.key)}
                        aria-pressed={isSelected}
                        className={`relative flex flex-col rounded-2xl border px-5 py-5 text-left transition-all ${
                          isSelected
                            ? "border-[#F2671A] bg-[#F2671A]/[0.07] shadow-[0_16px_40px_-24px_rgba(242,103,26,0.9)]"
                            : "border-white/10 bg-white/[0.03] hover:border-white/25"
                        } ${blocked ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#F2671A]">
                            {option.featured ? <Zap className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                            {option.badge}
                          </span>
                          {isSelected && (
                            <span className="rounded-full bg-[#F2671A] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                              Selected
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex items-baseline gap-1">
                          {price ? (
                            <>
                              <span className="font-title text-3xl font-extrabold tracking-tight text-[#EFEADD]">
                                {price}
                              </span>
                              <span className="text-xs font-medium text-[#EFEADD]/55">{priceUnit}</span>
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-[#EFEADD]/55">Not available</span>
                          )}
                        </div>
                        {price && note && (
                          <p className="mt-1 text-[11px] leading-relaxed text-[#EFEADD]/45">{note}</p>
                        )}

                        <p className="mt-3 text-xs leading-relaxed text-[#EFEADD]/55">{option.description}</p>

                        <ul className="mt-3 space-y-1.5">
                          {option.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-[11px] leading-relaxed text-[#EFEADD]/70">
                              <Check className="mt-0.5 h-3 w-3 shrink-0 text-[#F2671A]" aria-hidden="true" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>

                        {blocked && (
                          <p className="mt-3 text-[11px] font-medium text-[#F2671A]/80">{blocked}</p>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Currency */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-[#EFEADD]/40">Pay in</span>
                  {SUPPORTED_CURRENCIES.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCurrency(code)}
                      aria-pressed={currency === code}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                        currency === code
                          ? "bg-[#EFEADD] text-[#152323]"
                          : "border border-white/15 text-[#EFEADD]/60 hover:text-[#EFEADD]"
                      }`}
                    >
                      {code.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Summary + call to action */}
                <div className="mt-7 flex flex-col items-center gap-3">
                  {summary && (
                    <p className="text-xs text-[#EFEADD]/55">
                      {summary} — {TRIAL_DAYS} days free
                    </p>
                  )}
                  {billingCycle === "annual" && (
                    <p className="max-w-md text-center text-[11px] leading-relaxed text-[#EFEADD]/45">
                      Your {TRIAL_DAYS} days are free. The annual price applies when the trial ends.
                    </p>
                  )}

                  {selectedBlockedReason && (
                    <p className="text-[11px] font-medium text-[#F2671A]/80">{selectedBlockedReason}</p>
                  )}

                  {checkoutError && (
                    <p role="alert" className="text-[11px] font-medium text-[#F2671A]/90">
                      {checkoutError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={startTrial}
                    disabled={submitting || Boolean(selectedBlockedReason)}
                    className="mt-1 w-full rounded-full bg-[#F2671A] px-8 py-4 text-base font-semibold text-white shadow-[0_14px_40px_-16px_rgba(242,103,26,0.9)] transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[300px]"
                  >
                    {submitting ? "Opening secure checkout..." : "Start my free trial"}
                  </button>

                  <p className="mt-2 flex items-center justify-center gap-2 text-[11px] text-[#EFEADD]/45">
                    <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                    Have a promo code? You can apply it at checkout.
                  </p>

                  <Link
                    href="/dashboard"
                    className="mt-1 text-xs text-[#EFEADD]/45 underline-offset-4 transition-colors hover:text-[#EFEADD]/70 hover:underline"
                  >
                    Not right now, take me to my dashboard
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-[#EFEADD]/35">
          <Lock className="h-3 w-3" aria-hidden="true" />
          Secure checkout by Stripe. The Actors Copilot never sees your card details.
        </p>
      </div>

      {/* Stage floor gradient, the visual anchor of the landing page */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 z-[5] h-[6vh] w-full md:h-[8vh]"
        style={{
          background: `
            radial-gradient(ellipse at 80% 0%, rgba(220, 200, 150, 0.25) 0%, transparent 50%),
            linear-gradient(to bottom, rgba(15, 20, 20, 0.9) 40%, #000000 100%)
          `,
          borderTop: "1px solid rgba(15, 20, 20, 1)",
          boxShadow: "0px -5px 10px rgba(15, 20, 20, 0.9)",
        }}
      />
    </div>
  )
}
