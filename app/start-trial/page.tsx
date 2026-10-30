"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { redirectTo } from "@/lib/navigate"
import Link from "next/link"
import { Ticket } from "lucide-react"

/**
 * Seconds shown before the automatic hand-off to the Stripe Checkout.
 * The user can always skip the wait with the primary button.
 */
const COUNTDOWN_SECONDS = 15

const RING_RADIUS = 26
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

type ViewState = "loading" | "ready" | "error" | "skipped"

/**
 * Trial recovery interstitial.
 *
 * Shown when an account still owes the activation of its free trial (for
 * example after a server side hiccup interrupted the first checkout). The
 * page explains what happened in a friendly way and then hands the user over
 * to the Stripe Checkout, either automatically after a short countdown or
 * immediately through the primary button.
 *
 * @returns The branded recovery screen
 */
export default function StartTrialPage() {
  const [view, setView] = useState<ViewState>("loading")
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS)

  // 1. Resolve the checkout session for the signed in account.
  useEffect(() => {
    let cancelled = false

    const loadCheckout = async () => {
      try {
        const response = await fetch("/api/billing/recovery", { method: "POST" })

        // No session: send the visitor to the sign in screen instead of
        // showing a confusing error. The view stays in its loading state
        // because the browser is already navigating away.
        if (response.status === 401) {
          redirectTo("/login")
          return
        }

        if (!response.ok) throw new Error("recovery request failed")

        const data = await response.json()
        if (cancelled) return

        if (!data?.pending || !data?.checkoutUrl) {
          // Nothing to recover: the account is already in a good state.
          setView("skipped")
          window.setTimeout(() => {
            redirectTo("/dashboard")
          }, 1200)
          return
        }

        setCheckoutUrl(data.checkoutUrl)
        setView("ready")
      } catch {
        if (!cancelled) setView("error")
      }
    }

    loadCheckout()

    return () => {
      cancelled = true
    }
  }, [])

  // 2. Countdown.
  useEffect(() => {
    if (view !== "ready" || !checkoutUrl) return

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [view, checkoutUrl])

  // 3. Automatic hand-off when the countdown reaches zero.
  useEffect(() => {
    if (view !== "ready" || !checkoutUrl) return
    if (secondsLeft > 0) return

    redirectTo(checkoutUrl)
  }, [view, secondsLeft, checkoutUrl])

  const goToCheckout = () => {
    if (checkoutUrl) redirectTo(checkoutUrl)
  }

  const progress = (COUNTDOWN_SECONDS - secondsLeft) / COUNTDOWN_SECONDS

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#152323] px-5 py-16">
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
          <Image
            src="/spotlight.png"
            alt=""
            fill
            className="object-contain object-top"
            priority
          />
        </div>
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-xl">
        <div className="rounded-[28px] border border-white/10 bg-[#0e1919]/92 px-7 py-9 shadow-[0_24px_80px_-30px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:px-10 sm:py-11">
          <div className="flex flex-col items-center text-center">
            <div className="relative h-24 w-24">
              <Image src="/image.png" alt="The Actors Copilot" fill className="object-contain" priority />
            </div>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#F2671A]">
              One quick thing
            </p>

            {view === "loading" && (
              <>
                <h1 className="font-title mt-3 text-4xl font-bold leading-[1.05] tracking-tight text-[#EFEADD] sm:text-5xl">
                  Getting your trial ready
                </h1>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-[#EFEADD]/70">
                  One moment — we&apos;re opening your secure checkout.
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

                <p className="mt-5 max-w-md text-sm leading-relaxed text-[#EFEADD]/75">
                  A brief delay on our side meant your 14-day free trial never started. Nothing has been
                  charged, and your account is ready — all that is left is to switch those 14 days on.
                </p>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-[#EFEADD]/55">
                  In a moment we&apos;ll take you to our secure checkout to activate it. It only takes a minute.
                </p>

                <ul className="mt-7 grid gap-3 text-left sm:grid-cols-3">
                  {[
                    { title: "14 days, on us", copy: "Full access to every feature from day one." },
                    { title: "No charge today", copy: "You’re only billed once your trial ends." },
                    { title: "Cancel anytime", copy: "Two clicks, no questions asked." },
                  ].map((item) => (
                    <li
                      key={item.title}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5"
                    >
                      <p className="text-[13px] font-semibold text-[#EFEADD]">{item.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-[#EFEADD]/55">{item.copy}</p>
                    </li>
                  ))}
                </ul>

                <div className="mt-9 flex flex-col items-center gap-5">
                  <button
                    type="button"
                    onClick={goToCheckout}
                    className="w-full rounded-full bg-[#F2671A] px-8 py-4 text-base font-semibold text-white shadow-[0_14px_40px_-16px_rgba(242,103,26,0.9)] transition-all hover:brightness-110 active:scale-[0.98] sm:w-auto sm:min-w-[280px]"
                  >
                    Start my free trial
                  </button>

                  <div className="flex items-center gap-3 text-xs text-[#EFEADD]/55" role="status" aria-live="polite">
                    <span className="relative h-9 w-9">
                      <svg viewBox="0 0 64 64" className="h-9 w-9 -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r={RING_RADIUS}
                          fill="none"
                          stroke="rgba(255,255,255,0.12)"
                          strokeWidth="4"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r={RING_RADIUS}
                          fill="none"
                          stroke="#F2671A"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={RING_CIRCUMFERENCE}
                          strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
                          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-[#EFEADD]">
                        {secondsLeft}
                      </span>
                    </span>
                    <span>
                      {secondsLeft > 0
                        ? `Taking you to secure checkout in ${secondsLeft}s`
                        : "Taking you to secure checkout now"}
                    </span>
                  </div>

                  <p className="mt-5 flex items-center justify-center gap-2 text-xs text-[#EFEADD]/45">
                    <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                    Have a promo code? You can apply it at checkout.
                  </p>

                  <Link
                    href="/dashboard"
                    className="mt-4 text-xs text-[#EFEADD]/45 underline-offset-4 transition-colors hover:text-[#EFEADD]/70 hover:underline"
                  >
                    Not right now, take me to my dashboard
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-[#EFEADD]/35">
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
