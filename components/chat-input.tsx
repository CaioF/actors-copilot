"use client";

import { useState, useRef, useEffect } from "react";
import { Paperclip, AudioLines } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!value.trim() || isLoading) return;
    onSend(value.trim());
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex justify-center px-8 pb-3 pt-2">
      <div className="flex w-full max-w-2xl items-center gap-2 rounded-full border border-[#C7C0B5]/60 bg-[#F0E8DC] px-4 py-2 shadow-sm">
        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6B6B6B] transition-colors hover:bg-[#E8DFD0] hover:text-[#2C3328]"
          aria-label="Attach file"
          type="button"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything..."
          disabled={isLoading}
          className="flex-1 bg-transparent text-sm text-[#2C3328] outline-none placeholder:text-[#6B6B6B]/60 disabled:opacity-50"
        />

        <button
          onClick={isRecording ? () => setIsRecording(false) : value.trim() ? handleSubmit : () => setIsRecording(true)}
          disabled={isLoading && !isRecording}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
            isRecording
              ? "animate-pulse bg-[#C45A3C] text-[#ffffff]"
              : "bg-[#E8721A] text-[#ffffff] hover:bg-[#E8721A]/90"
          }`}
          aria-label={
            isRecording ? "Stop recording" : value.trim() ? "Send message" : "Start recording"
          }
          type="button"
        >
          <AudioLines className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
