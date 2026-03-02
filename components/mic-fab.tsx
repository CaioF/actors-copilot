"use client"

import { Mic } from "lucide-react"
import { useState } from "react"

export function MicFab() {
  const [isRecording, setIsRecording] = useState(false)

  return (
    <button
      onClick={() => setIsRecording(!isRecording)}
      className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 ${
        isRecording
          ? "bg-[#C45A3C] text-[#ffffff] animate-pulse"
          : "bg-[#E8721A] text-[#ffffff]"
      }`}
      aria-label={isRecording ? "Stop recording" : "Start recording"}
    >
      <Mic className="h-5 w-5" />
    </button>
  )
}
