"use client";

import { useState } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";
import { Check, Shield, Zap, ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard-header";

interface TierCardProps {
  badge: string;
  price: string;
  description: string;
  features: string[];
  tierKey: "economy" | "business";
  isActive: boolean;
  isFeatured?: boolean;
  onSelect: (tier: "economy" | "business") => Promise<void>;
  loading: boolean;
}

function PricingCard({
  badge,
  price,
  description,
  features,
  tierKey,
  isActive,
  isFeatured = false,
  onSelect,
  loading,
}: TierCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-3xl p-8 transition-all shadow-sm relative overflow-hidden",
        isFeatured
          ? "bg-neutral-900 text-white border border-neutral-800 shadow-xl"
          : "bg-card text-card-foreground border border-border"
      )}
    >
      <div>
        <div className="flex items-center gap-2 mb-4">
          {isFeatured ? (
            <Shield className="h-4 w-4 text-primary shrink-0" />
          ) : (
            <Zap className="h-4 w-4 text-primary shrink-0" />
          )}
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            {badge}
          </span>
        </div>

        <div className="flex items-baseline mb-4">
          <span
            className={cn(
              "font-title text-4xl sm:text-5xl font-extrabold tracking-tight",
              isFeatured ? "text-white" : "text-foreground"
            )}
          >
            ${price}
          </span>
          <span
            className={cn(
              "ml-1 text-sm font-medium",
              isFeatured ? "text-neutral-400" : "text-muted-foreground"
            )}
          >
            /month
          </span>
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

      <button
        onClick={() => onSelect(tierKey)}
        disabled={loading || isActive}
        className={cn(
          "w-full rounded-full py-3.5 px-6 text-center text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-70 shadow-sm",
          isActive
            ? "bg-primary text-primary-foreground opacity-90 cursor-default"
            : isFeatured
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-card hover:bg-muted border border-border text-foreground"
        )}
      >
        {loading
          ? "Processing..."
          : isActive
          ? "Current Plan"
          : tierKey === "business"
          ? "Upgrade to Business Class"
          : "Upgrade to Economy Class"}
      </button>
    </div>
  );
}

export default function UpgradePage() {
  const { user } = useAuth();
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const handleTierSelection = async (tier: "economy" | "business"): Promise<void> => {
    if (actionLoading) return;
    setActionLoading(true);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, billingCycle }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        console.error("❌ Checkout initialization failed:", data.error);
      }
    } catch (err) {
      console.error("❌ Fatal error dispatching pricing subscription flow:", err);
    } finally {
      setActionLoading(false);
    }
  };

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
            Upgrade your subscription tier below to unlock advanced features and toolkits.
          </p>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-12">
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
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
          <PricingCard
            badge="ECONOMY CLASS"
            price={billingCycle === "annual" ? "15.00" : "19.00"}
            description="Perfect for actors expanding their base analytical workflows and audition setups."
            tierKey="economy"
            isActive={user?.tier === "economy"}
            loading={actionLoading}
            onSelect={handleTierSelection}
            features={[
              "Access to Personal DNA Extraction chats",
              "Full Audition Breakdown generation features",
              "Multi-step Audition Wizard access",
              "Standard storage metrics limits",
            ]}
          />

          <PricingCard
            badge="BUSINESS CLASS"
            price={billingCycle === "annual" ? "23.00" : "29.00"}
            description="The complete experience offering advanced generative modules and expert system toolsets."
            tierKey="business"
            isFeatured={true}
            isActive={user?.tier === "business"}
            loading={actionLoading}
            onSelect={handleTierSelection}
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