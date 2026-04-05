import { Mic } from "lucide-react"

export function MemoryRecordingBanner() {
  return (
    <div className="mx-8 mt-6 flex items-center justify-between rounded-2xl bg-[#E8DFD0] px-8 py-6">
      <div className="flex-1 text-center pr-4">
        <p className="text-sm leading-relaxed  text-[#2C3328]">
          {"Quick Memory Recording: Moments of truth don't wait."}
        </p>
        <p className="text-sm leading-relaxed text-[#2C3328]">
           Tap the mic anytime to record personal thoughts, emotional anchors, or past experiences.  
        
          The more stories you share, the better your Copilot understands your unique foundation.
        </p>
        <p className="text-sm shadow-2xl leading-relaxed text-[#624604]">
           Press the Mic button in the bottom-right corner of the page to start recording at any time.
        </p>
      </div>

      
    </div>
  )
}
