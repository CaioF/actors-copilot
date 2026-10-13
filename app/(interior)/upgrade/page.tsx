"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";
import { Check, Shield, Zap, Lock, Info, Star } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import {
  DEFAULT_CURRENCY,
  SUPPORTED_CURRENCIES,
  clearPlanSelection,
  formatDisplayPrice,
  getDisplayPrice,
  parsePlanSelection,
  readPlanSelection,
  type RequestedCurrency,
  type RequestedPlan,
} from "@/lib/plan-selection";
import type { CurrencySupportMap } from "@/lib/billing-currency";

type BillingCycle = "monthly" | "annual";

const PLAN_LABELS: Record<RequestedPlan, string> = {
  economy: "Economy Class",
  business: "Business Class",
};

const currencySupportFetcher = async (url: string): Promise<CurrencySupportMap | null> => {
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { support: CurrencySupportMap | null };
  return data.support;
};

interface TierCardProps {
  badge: string;
  price: string | null;
  description: string;
  features: string[];
  tierKey: RequestedPlan;
  isActive: boolean;
  isRequested: boolean;
  isFeatured?: boolean;
  onSelect: (tier: RequestedPlan) => Promise<void>;
  loading: boolean;
  checkoutBlockedReason: string | null;
}

function PricingCard({
  badge,
  price,
  description,
  features,
  tierKey,
  isActive,
  isRequested,
  isFeatured = false,
  onSelect,
  loading,
  checkoutBlockedReason,
}: TierCardProps) {
  const isBlocked = !isActive && Boolean(checkoutBlockedReason);

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-3xl p-8 transition-all shadow-sm relative overflow-hidden",
        isFeatured
          ? "bg-neutral-900 text-white border border-neutral-800 shadow-xl"
          : "bg-card text-card-foreground border border-border",
        isRequested && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            {isFeatured ? (
              <Shield className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <Zap className="h-4 w-4 text-primary shrink-0" />
            )}
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              {badge}
            </span>
          </div>
          {isRequested && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              <Star className="h-3 w-3" aria-hidden="true" />
              Your selection
            </span>
          )}
        </div>

        <div className="flex items-baseline mb-4">
          {price ? (
            <>
              <span
                className={cn(
                  "font-title text-4xl sm:text-5xl font-extrabold tracking-tight",
                  isFeatured ? "text-white" : "text-foreground"
                )}
              >
                {price}
              </span>
              <span
                className={cn(
                  "ml-1 text-sm font-medium",
                  isFeatured ? "text-neutral-400" : "text-muted-foreground"
                )}
              >
                /month
              </span>
            </>
          ) : (
            <span
              className={cn(
                "text-sm font-semibold",
                isFeatured ? "text-neutral-300" : "text-muted-foreground"
              )}
            >
              Price not yet available in this currency
            </span>
          )}
        </div>

        <p
          className={cn(
            "text-xs sm:text-sm leading-relaxed mb-8",
            isFeatured ? "text-neutral-300" : "text-muted-foreground"
          )}
        >
          {description}
        </p>

        <ul className="space-y-3.5 mb-8">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm">
              <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
              <span className={isFeatured ? "text-neutral-200" : "text-foreground/90"}>
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => onSelect(tierKey)}
          disabled={loading || isActive || isBlocked}
          className={cn(
            "w-full rounded-full py-3.5 px-6 text-center text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-70 shadow-sm",
            isActive
              ? "bg-primary text-primary-foreground opacity-90 cursor-default"
              : isBlocked
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : isFeatured || isRequested
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-card hover:bg-muted border border-border text-foreground"
          )}
        >
          {loading
            ? "Processing..."
            : isActive
            ? "Current Plan"
            : isBlocked
            ? "Checkout unavailable"
            : tierKey === "business"
            ? "Upgrade to Business Class"
            : "Upgrade to Economy Class"}
        </button>
        {isBlocked && (
          <p
            className={cn(
              "text-[11px] text-center leading-relaxed",
              isFeatured ? "text-neutral-400" : "text-muted-foreground"
            )}
          >
            {checkoutBlockedReason}
          </p>
        )}
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense
      fallback={
        <main className="w-full min-h-screen bg-background flex items-center justify-center">
          <span className="animate-pulse text-xs text-muted-foreground">Loading plans...</span>
        </main>
      }
    >
      <UpgradeContent />
    </Suspense>
  );
}

function UpgradeContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const urlSelection = parsePlanSelection(searchParams.get("plan"), searchParams.get("currency"));

  const [storedSelection] = useState(() => (urlSelection ? null : readPlanSelection()));
  const initialSelection = urlSelection ?? storedSelection;

  const requestedPlan: RequestedPlan | null = initialSelection?.plan ?? null;
  const [currency, setCurrency] = useState<RequestedCurrency>(
    initialSelection?.currency ?? DEFAULT_CURRENCY
  );
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  useEffect(() => {
    clearPlanSelection();
  }, []);

  const { data: currencySupport, isLoading: supportLoading } = useSWR(
    "/api/billing/currencies",
    currencySupportFetcher,
    { revalidateOnFocus: false }
  );

  const currencyLabel = currency.toUpperCase();
  const currentTier = user?.tier && user.tier !== "free" ? user.tier : null;
  const hasActivePlan =
    Boolean(currentTier) &&
    (user?.subscriptionStatus === "active" || user?.subscriptionStatus === "trialing");

  const displayPrice = (plan: RequestedPlan): string | null => {
    const amount = getDisplayPrice(plan, currency, billingCycle);
    return amount === null ? null : formatDisplayPrice(amount, currency);
  };

  // USD keeps the existing checkout behaviour; other currencies require a verified Stripe price.
  const checkoutBlockedReason = (plan: RequestedPlan): string | null => {
    if (currency === "usd") return null;
    if (getDisplayPrice(plan, currency, billingCycle) === null) {
      return `${billingCycle === "annual" ? "Annual" : "Monthly"} billing in ${currencyLabel} is not yet available.`;
    }
    if (supportLoading) return "Checking payment availability...";
    if (!currencySupport?.[billingCycle]?.[plan]?.includes(currency)) {
      return `Payments in ${currencyLabel} are not yet available. Switch to USD to subscribe now.`;
    }
    return null;
  };

  const handleTierSelection = async (tier: RequestedPlan): Promise<void> => {
    if (actionLoading || checkoutBlockedReason(tier)) return;
    setActionLoading(true);
    setCheckoutError(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          billingCycle,
          ...(currency !== "usd" ? { currency } : {}),
        }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout initialization failed:", data.error);
        setCheckoutError(data.error || "We could not start checkout. Please try again.");
      }
    } catch (err) {
      console.error("Fatal error dispatching pricing subscription flow:", err);
      setCheckoutError("We could not start checkout. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const nonUsdUnavailable =
    currency !== "usd" &&
    !supportLoading &&
    (["economy", "business"] as RequestedPlan[]).some((plan) => checkoutBlockedReason(plan));

  return (
    <main className="w-full min-h-screen bg-background text-foreground transition-colors overflow-y-auto pb-24 sm:pb-32">
      <DashboardHeader title="Choose your plan." />

      <div className="px-4 sm:px-8 py-6 max-w-5xl mx-auto w-full">
        {/* Hero Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="h-[1px] w-12 bg-border" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              INVEST IN YOUR CRAFT
            </span>
            <div className="h-[1px] w-12 bg-border" />
          </div>

          <h1 className="font-title text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            Choose your <span className="text-primary">plan.</span>
          </h1>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {requestedPlan
              ? `You selected ${PLAN_LABELS[requestedPlan]}. Review it below and continue when you're ready.`
              : "Upgrade your subscription tier below to unlock advanced features and toolkits."}
          </p>
        </div>

        {/* Requested vs current plan notice */}
        {requestedPlan && hasActivePlan && currentTier && (
          <div
            role="status"
            className="max-w-4xl mx-auto mb-8 flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-xs sm:text-sm"
          >
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
            <p className="text-muted-foreground leading-relaxed">
              {currentTier === requestedPlan ? (
                <>
                  You&apos;re already subscribed to{" "}
                  <span className="font-semibold text-foreground">{PLAN_LABELS[currentTier]}</span>.
                  No changes will be made.
                </>
              ) : (
                <>
                  Your current plan is{" "}
                  <span className="font-semibold text-foreground">{PLAN_LABELS[currentTier]}</span>.
                  You selected{" "}
                  <span className="font-semibold text-foreground">{PLAN_LABELS[requestedPlan]}</span>.
                  Nothing changes unless you choose to continue.
                </>
              )}
            </p>
          </div>
        )}

        {/* Billing Cycle + Currency */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
          <div className="inline-flex items-center bg-card border border-border rounded-full p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "px-6 py-2 rounded-full text-xs font-semibold transition-all",
                billingCycle === "monthly"
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              className={cn(
                "px-6 py-2 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5",
                billingCycle === "annual"
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Annual</span>
              <span className="text-primary font-bold text-[10px]">-20%</span>
            </button>
          </div>

          <div
            role="radiogroup"
            aria-label="Currency"
            className="inline-flex items-center bg-card border border-border rounded-full p-1 shadow-sm"
          >
            {SUPPORTED_CURRENCIES.map((code) => (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={currency === code}
                onClick={() => {
                  setCurrency(code);
                  setCheckoutError(null);
                }}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-semibold transition-all",
                  currency === code
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-4xl mx-auto mb-10 min-h-5 space-y-2">
          {nonUsdUnavailable && (
            <p role="status" className="text-center text-xs text-muted-foreground leading-relaxed">
              {`Prices are shown in ${currencyLabel} for reference. Checkout in ${currencyLabel} isn't available for every option yet, and we won't charge you in a different currency without your choice.`}
            </p>
          )}
          {checkoutError && (
            <p role="alert" className="text-center text-xs font-medium text-destructive">
              {checkoutError}
            </p>
          )}
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
          <PricingCard
            badge="ECONOMY CLASS"
            price={displayPrice("economy")}
            description="Perfect for actors expanding their base analytical workflows and audition setups."
            tierKey="economy"
            isActive={user?.tier === "economy"}
            isRequested={requestedPlan === "economy"}
            loading={actionLoading}
            onSelect={handleTierSelection}
            checkoutBlockedReason={checkoutBlockedReason("economy")}
            features={[
              "Access to Personal DNA Extraction chats",
              "Full Audition Breakdown generation features",
              "Multi-step Audition Wizard access",
              "Standard storage metrics limits",
            ]}
          />

          <PricingCard
            badge="BUSINESS CLASS"
            price={displayPrice("business")}
            description="The complete experience offering advanced generative modules and expert system toolsets."
            tierKey="business"
            isFeatured={true}
            isActive={user?.tier === "business"}
            isRequested={requestedPlan === "business"}
            loading={actionLoading}
            onSelect={handleTierSelection}
            checkoutBlockedReason={checkoutBlockedReason("business")}
            features={[
              "Everything included in Economy Class",
              "Exclusive access to the AI Acting Coach",
              "Deep character lens profile analysis modules",
              "Priority processing speeds on document extractions",
              "Full Actor Profile management tools",
            ]}
          />
        </div>

        {/* Subtitle / Secure Footer Section (Corrigido o overlap) */}
        <div className="mt-16 pt-8 border-t border-border/50 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 text-primary" />
            <span>Anytime cancellation. Secure payments via Stripe.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
