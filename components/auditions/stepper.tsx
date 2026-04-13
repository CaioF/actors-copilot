"use client";

import { Check } from "lucide-react";

interface StepperProps {
  currentStep: number;
}

const steps = [
  { num: 1, label: "Basics" },
  { num: 2, label: "Sides" },
  { num: 3, label: "Brief" },
  { num: 4, label: "Review & Generate" },
];

/**
 * Stepper Component
 * Renders a step progress indicator showing the current step in the audition wizard.
 * @param currentStep - The current step number (1-4)
 */
export function Stepper({ currentStep }: StepperProps) {
  return (
    <div className="flex items-center justify-center w-full max-w-5xl mx-auto mb-16">
      {steps.map((step, index) => {
        const isActive = step.num === currentStep;
        const isCompleted = step.num < currentStep;

        return (
          <div key={step.num} className="flex items-center flex-1 last:flex-initial">
            {/* O Círculo do Número e Label */}
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-full text-base font-semibold transition-colors duration-300
                  ${
                    isActive || isCompleted
                      ? "bg-[#FF7316] text-white"
                      : "bg-[#D9D9D9] text-white/50 border border-white/20"
                  }
                `}
              >
                {isCompleted ? <Check className="w-5 h-4" /> : step.num}
              </div>
              <span className={`font-medium ${isActive ? 'text-[#2C3328]' : 'text-[#2C3328]/60'}`}>
                {step.label}
              </span>
            </div>

            {/* A Linha Conectora (não renderiza depois do último passo) */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-[2px] mx-6 transition-colors duration-300
                  ${isCompleted ? "bg-[#FF7316]" : "bg-[#2C3328]/20"}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}