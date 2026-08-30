"use client";

import React, { useState } from "react";
import { Check, Copy, Rocket, Shield, Sparkles } from "lucide-react";
import type { AuditionPlanData } from "@/lib/acting-coach/contracts";

interface AuditionPlanCardProps {
  plan: AuditionPlanData;
  roleName?: string;
  projectName?: string;
}

export function AuditionPlanCard({ plan, roleName, projectName }: AuditionPlanCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = `YOUR AUDITION PLAN
Project: ${projectName || "Audition"}
Role: ${roleName || "Character"}

Before the scene: ${plan.before_scene}
Relationship: ${plan.relationship}
Want: ${plan.want}
Stakes: ${plan.stakes}
Obstacle: ${plan.obstacle}
Primary action: ${plan.primary_action}
The shift: ${plan.shift}
Private thought: ${plan.private_thought}
Contradiction: ${plan.contradiction}
First five seconds: ${plan.first_five_seconds}
Grounding: ${plan.grounding}
Final instruction: ${plan.final_instruction}

${plan.sign_off || "You are cleared for takeoff."}`;

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fields: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: "Before the scene", value: plan.before_scene },
    { label: "Relationship", value: plan.relationship },
    { label: "Want", value: plan.want },
    { label: "Stakes", value: plan.stakes },
    { label: "Obstacle", value: plan.obstacle },
    { label: "Primary action", value: plan.primary_action },
    { label: "The shift", value: plan.shift },
    { label: "Private thought", value: plan.private_thought },
    { label: "Contradiction", value: plan.contradiction },
    { label: "First five seconds", value: plan.first_five_seconds },
    { label: "Grounding", value: plan.grounding },
    { label: "Final instruction", value: plan.final_instruction, highlight: true },
  ];

  return (
    <div className="w-full max-w-lg mx-auto bg-[#232920] border-2 border-[#E8721A]/60 text-[#E8DFD0] rounded-3xl p-6 shadow-2xl space-y-5 transition-colors my-4">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#3B4339] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8721A] text-white shadow-md">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-title text-xl font-bold text-[#F5F0E8] uppercase tracking-wide">
              Your Audition
            </h3>
            {(projectName || roleName) && (
              <p className="text-xs text-[#E8721A] font-semibold uppercase tracking-wider">
                {roleName} • {projectName}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#4E574B] bg-[#3B4339] hover:bg-[#4E574B] text-xs font-medium text-[#F5F0E8] px-3 py-1.5 transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Plan Items */}
      <div className="space-y-3 text-xs sm:text-sm">
        {fields.map((f, i) => (
          <div
            key={i}
            className={`p-3 rounded-2xl border ${
              f.highlight
                ? "bg-[#E8721A]/15 border-[#E8721A]/40 text-[#F5F0E8]"
                : "bg-[#2C3328] border-[#3B4339] text-[#D1C7B7]"
            }`}
          >
            <span className="font-bold text-[#E8721A] uppercase tracking-wider text-[11px] block mb-0.5">
              {f.label}:
            </span>
            <span className="leading-relaxed font-medium">{f.value}</span>
          </div>
        ))}
      </div>

      {/* Sign-off clearance banner */}
      <div className="pt-2 border-t border-[#3B4339] text-center">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#E8721A] text-white font-title text-base sm:text-lg font-bold shadow-lg">
          <Sparkles className="h-5 w-5" />
          <span>{plan.sign_off || "You are cleared for takeoff."}</span>
        </div>
      </div>
    </div>
  );
}
