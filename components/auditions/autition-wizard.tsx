"use client";

import { useState } from "react";
import { AuditionFormData, initialAuditionData, AuditionStep } from "@/lib/audition-types";
import { Stepper } from "./stepper";
import { StepBasics } from "@/components/auditions/step/step-basic"

export function AuditionWizard() {
  const [currentStep, setCurrentStep] = useState<AuditionStep>(1);
  const [formData, setFormData] = useState<AuditionFormData>(initialAuditionData);

  // Handlers para navegação
  const handleNext = () => setCurrentStep((prev) => Math.min(prev + 1, 5) as AuditionStep);
  const handleBack = () => setCurrentStep((prev) => Math.max(prev - 1, 1) as AuditionStep);

  // Handler para atualizar dados do form de qualquer etapa
  const updateFormData = (data: Partial<AuditionFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  // Função para simular a submissão para a IA (Step 5)
  const handleGenerate = async () => {
    setCurrentStep(5); // Vai para a tela de loading
    console.log("Enviando dados para a IA:", formData);
    // Aqui entrará o fetch para a nossa rota /api/auditions/analyze
  };

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto p-6 h-full">
      {/* AQUI ENTRARÁ O COMPONENTE STEPPER (Barra de progresso) 
        Só não o mostramos no step 5 (Gerando)
      */}
      {currentStep < 5 && (
        <div className="mb-8">
          <p className="text-gray-500 text-sm mb-4">Stepper Placeholder: Step {currentStep} of 4</p>
          <Stepper currentStep={currentStep} /> 
        </div>
      )}

      {/* ÁREA DE CONTEÚDO DINÂMICO (Renderiza a etapa atual) */}
      <div className="flex-1 rounded-2xl bg-[#4A5340] shadow-xl overflow-hidden p-8 text-[#EADDCE]">
        {currentStep === 1 && (
          <div className="h-full flex flex-col justify-between">
            <h2>Step 1: Basics (Form here)</h2>
            <div className="flex justify-end mt-8">
              <button onClick={handleNext} className="bg-[#F97316] text-white px-6 py-2 rounded-full font-medium">Next</button>
            </div>
          </div>
        )}
        
        {currentStep === 2 && (
          <div className="h-full flex flex-col justify-between">
            <h2>Step 2: Sides (Upload here)</h2>
            <div className="flex justify-between mt-8">
              <button onClick={handleBack} className="border border-[#EADDCE] px-6 py-2 rounded-full font-medium">Back</button>
              <button onClick={handleNext} className="bg-[#F97316] text-white px-6 py-2 rounded-full font-medium">Next</button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="h-full flex flex-col justify-between">
            <h2>Step 3: Brief (Upload here)</h2>
            <div className="flex justify-between mt-8">
              <button onClick={handleBack} className="border border-[#EADDCE] px-6 py-2 rounded-full font-medium">Back</button>
              <button onClick={handleNext} className="bg-[#F97316] text-white px-6 py-2 rounded-full font-medium">Next</button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="h-full flex flex-col justify-between">
            <h2>Step 4: Review</h2>
            <div className="flex justify-between mt-8">
              <button onClick={handleBack} className="border border-[#EADDCE] px-6 py-2 rounded-full font-medium">Back</button>
              <button onClick={handleGenerate} className="bg-[#F97316] text-white px-6 py-2 rounded-full font-medium">Generate</button>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316] mb-4"></div>
            <h2 className="text-xl font-medium">Generating your breakdown...</h2>
            <p className="text-sm opacity-70 mt-2">This usually takes a few seconds</p>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="mt-8 flex justify-center space-x-6 text-sm text-gray-400">
        <span>🔒 NDA Safe</span>
        <span>🗑️ Delete Anytime</span>
        <span>🛡️ Private By Default</span>
      </div>
    </div>
  );
}