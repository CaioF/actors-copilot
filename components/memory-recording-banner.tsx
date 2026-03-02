import { Mic } from "lucide-react"

export function MemoryRecordingBanner() {
  return (
    <div className="mx-8 mt-6 flex items-center justify-between rounded-2xl bg-[#E8DFD0] px-8 py-6">
      <div className="flex-1 text-center pr-4">
        <p className="text-sm leading-relaxed text-[#2C3328]">
          {"Quick Memory Recording: Moments of truth don't wait."}
        </p>
        <p className="text-sm leading-relaxed text-[#2C3328]">
          Neither should your tools. Press the button to start recording anytime.
        </p>
      </div>
      <button
        className="ml-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E8721A] text-[#ffffff] shadow-lg transition-all hover:bg-[#E8721A]/90 hover:scale-105"
        aria-label="Start recording"
      >
        <Mic className="h-5 w-5" />
      </button>
    </div>
  )
}
