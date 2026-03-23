"use client";

import { Check } from "lucide-react";

interface StepperProps {
  currentStep: number;
}

const steps = [
  { num: 1, label: "Basics" },
  { num: 2, label: "Sides" },
  { num: 3, label: "Brief" },
  { num: 4, label: "Review" },
];

export function Stepper({ currentStep }: StepperProps) {
  return (
    <div className="flex items-center justify-center w-full max-w-lg mx-auto mb-8">
      {steps.map((step, index) => {
        const isActive = step.num === currentStep;
        const isCompleted = step.num < currentStep;

        return (
          <div key={step.num} className="flex items-center">
            {/* O Círculo do Número */}
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors duration-300
                ${
                  isActive || isCompleted
                    ? "bg-[#E8721A] text-white"
                    : "bg-[#2A3325] text-white/50 border border-white/20"
                }
              `}
            >
              {isCompleted ? <Check className="w-4 h-4" /> : step.num}
            </div>

            {/* A Linha Conectora (não renderiza depois do último passo) */}
            {index < steps.length - 1 && (
              <div
                className={`w-16 sm:w-24 h-0.5 mx-2 transition-colors duration-300
                  ${isCompleted ? "bg-[#E8721A]" : "bg-[#2A3325]"}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}