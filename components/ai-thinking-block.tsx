"use client"

import { useState, useEffect } from "react"

interface AiThinkingBlockProps {
  isReprocessing?: boolean; 
}

export function AiThinkingBlock({ isReprocessing = false }: AiThinkingBlockProps) {
  const [isTakingLong, setIsTakingLong] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTakingLong(true);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  const showReprocessingText = isReprocessing || isTakingLong;

  return (
    <div className="flex w-full justify-start my-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-4 px-5 py-3.5 rounded-2xl bg-[#E8DFD0]/40 border border-[#C7C0B5]/50 text-[#2C3328] shadow-sm transition-all duration-500 ease-in-out">
        
        <div className="relative flex h-4 w-4 items-center justify-center transition-all duration-500">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E8721A] opacity-40"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E8721A]"></span>
        </div>
        
        <span className="text-sm font-medium tracking-wide transition-opacity duration-500">
          {showReprocessingText 
            ? "The Coach is rethinking the approach..." 
            : "The Coach is analyzing your response..."}
        </span>
        
      </div>
    </div>
  )
}