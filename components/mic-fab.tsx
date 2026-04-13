"use client"

import { Mic } from "lucide-react"
import { useState, useEffect } from "react"

/**
 * MicFab Component
 * Floating action button for toggling microphone recording.
 * Shows a toast message when recording is stopped.
 */
export function MicFab() {
  const [isRecording, setIsRecording] = useState(false)
  const [showMessage, setShowMessage] = useState(false)

  /**
   * Toggles the recording state and manages the visibility of the toast message.
   */
  const handleToggleRecording = () => {
    if (isRecording) {
      // Quando parar de gravar: desativa o botão e mostra a mensagem
      setIsRecording(false)
      setShowMessage(true)
    } else {
      // Quando começar a gravar: ativa o botão e esconde a mensagem (caso ainda esteja visível)
      setIsRecording(true)
      setShowMessage(false)
    }
  }

  // Effect para esconder a mensagem automaticamente após 3 segundos
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    
    if (showMessage) {
      timer = setTimeout(() => {
        setShowMessage(false)
      }, 3000) // 3000ms = 3 segundos
    }
    
    // Cleanup do timer para evitar vazamento de memória se o componente desmontar
    return () => {
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [showMessage])

  return (
    // Transformei em uma div container para agrupar o botão e a mensagem
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      
      {/* Mensagem Temporária (Toast) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-hidden={!showMessage}
        className={`transition-all duration-300 ease-in-out ${
          showMessage
            ? "translate-y-0 opacity-100"
            : "translate-y-2 opacity-0 pointer-events-none" // pointer-events-none impede cliques quando invisível
        }`}
      >
        {/* Usei as cores da sua paleta para manter a coesão visual */}
        <div className="rounded-lg bg-[#2C3328] px-4 py-2 text-sm text-[#E8DFD0] shadow-lg">
          Memory added to your DNA!
        </div>
      </div>

      {/* Botão Fab original */}
      <button
        onClick={handleToggleRecording}
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 ${
          isRecording
            ? "bg-[#C45A3C] text-[#ffffff] animate-pulse"
            : "bg-[#E8721A] text-[#ffffff]"
        }`}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        <Mic className="h-5 w-5" />
      </button>
      
    </div>
  )
}