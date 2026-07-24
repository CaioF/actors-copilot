"use client";

import { useState } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";
import { Check, Shield, Zap, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface TierCardProps {
  title: string;
  price: string;
  description: string;
  features: string[];
  tierKey: "economy" | "business";
  isActive: boolean;
  onSelect: (tier: "economy" | "business") => Promise<void>;
  loading: boolean;
}

/**
 * Component representing an individual pricing and option choice segment.
 *
 * @component
 */
function PricingCard({
  title,
  price,
  description,
  features,
  tierKey,
  isActive,
  onSelect,
  loading,
}: TierCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-2xl border p-6 shadow-md transition-all",
        isActive
          ? "border-[#E8721A] bg-[#2C3328]/10 ring-2 ring-[#E8721A]"
          : "border-[#3D4A3C]/20 bg-[#F5F0E8]"
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          {tierKey === "business" ? (
            <Shield className="h-5 w-5 text-[#E8721A]" />
          ) : (
            <Zap className="h-5 w-5 text-[#E8721A]" />
          )}
          <h3 className="font-title text-xl font-bold text-[#2C3328]">{title}</h3>
        </div>
        <p className="mt-2 text-xs text-[#2C3328]/70">{description}</p>
        <div className="mt-4 flex items-baseline text-[#2C3328]">
          <span className="font-title text-4xl font-extrabold tracking-tight">{price}</span>
          <span className="ml-1 text-sm font-medium text-[#2C3328]/60">/month</span>
        </div>

        <ul className="mt-6 space-y-3">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-[#2C3328]/80">
              <Check className="h-4 w-4 shrink-0 text-[#E8721A] mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => onSelect(tierKey)}
        disabled={loading}
        className={cn(
          "mt-8 block w-full rounded-lg py-2.5 text-center text-sm font-medium transition-all active:scale-95 disabled:opacity-50",
          isActive
            ? "bg-[#E8721A] text-white hover:bg-[#E8721A]/90"
            : "bg-[#2C3328] text-[#F5F0E8] hover:bg-[#3D4A3C]"
        )}
      >
        {loading ? "Processing..." : `Upgrade to ${title}`}
      </button>
    </div>
  );
}

/**
 * Upgrade Funnel Page Component.
 * Presents available Stripe products and pricing matrix allocations dynamically to users.
 *
 * @component
 * @returns {JSX.Element} The rendered subscription options matrix view.
 */
export default function UpgradePage() {
  const { user } = useAuth();
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  /**
   * Dispatches the targeted tier allocation parameter to our transaction endpoint layer.
   *
   * @async
   * @param {"economy" | "business"} tier - The targeted billing plan tier choice.
   * @returns {Promise<void>}
   */
  const handleTierSelection = async (tier: "economy" | "business"): Promise<void> => {
    if (actionLoading) return;
    setActionLoading(true);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
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
    <div className="flex min-h-screen flex-col bg-[#F5F0E8] px-6 py-12 lg:px-8 justify-center items-center">
      <div className="w-full max-w-4xl">
        
        {/* Back Link to Safety */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#2C3328]/70 hover:text-[#E8721A] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        {/* Header Block */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-title text-3xl font-extrabold tracking-tight text-[#2C3328] sm:text-4xl">
            Choose Your Access Level
          </h2>
          <p className="mt-3 text-base text-[#2C3328]/70">
            You currently have a limited Free Plan account. Upgrade your subscription tier below to unlock advanced features and toolkits.
          </p>
        </div>

        {/* Pricing Layout Matrix */}
        <div className="grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
          
          {/* Economy Class Option Card */}
          <PricingCard
            title="Economy Class"
            price="19.00"
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

          {/* Business Class Option Card */}
          <PricingCard
            title="Business Class"
            price="29.00"
            description="The complete experience offering advanced generative modules and expert system toolsets."
            tierKey="business"
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
      </div>
    </div>
  );
}