import { Mic } from "lucide-react"

export function MemoryRecordingBanner() {
  return (
    <div className="mx-8 bg-[#3D4A3C] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xl border border-[#B7BCB6]/10">
      
      <div className="flex gap-4 items-center">
        {/* Ícone decorativo à esquerda (Opcional, mas ajuda a ancorar o olhar) */}
        <div className="bg-[#FF7316]/20 p-4 rounded-full shrink-0 hidden sm:flex">
          <Mic className="w-6 h-6 text-[#ff6600]" />
        </div>
        
        <div>
          <h3 className="text-[#EADDCE] text-xl font-medium font-title mb-1.5">
            Quick Memory Recording: Moments of truth don't wait.
          </h3>
          <p className="text-[#B7BCB6] text-sm max-w-4xl leading-relaxed">
            Tap the mic anytime to record personal thoughts, emotional anchors, or past experiences. The more stories you share, the better your Copilot understands your unique foundation.
            Press the Mic button in the bottom-right corner of the page to start recording at any time.
          </p>
        </div>
      </div>
      
      {/* Botão de Ação Destacado (Sem o pulse animation, como você pediu) */}
      <button
        className="flex items-center gap-3 px-8 py-4 bg-[#FF7316] text-white rounded-full font-medium hover:bg-[#FF7316]/90 transition-all shrink-0 shadow-lg shadow-[#FF7316]/20 hover:scale-105 active:scale-95"
        aria-label="Start recording"
      >
        <Mic className="h-5 w-5" />
        <span>Capture a Memory</span>
      </button>
      
    </div>
  )
}