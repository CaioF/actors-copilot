"use client";

import { useState, useMemo } from "react";
import { extractPlaceholders, fillTemplate } from "@/lib/template-filler";

interface PlaceholderFillFormProps {
  promptText: string;
  onFilled: (filledText: string) => void;
  onCancel: () => void;
}

export function PlaceholderFillForm({
  promptText,
  onFilled,
  onCancel,
}: PlaceholderFillFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  
  const placeholders = useMemo(() => extractPlaceholders(promptText), [promptText]);

  const renderPromptPreview = () => {
    const parts = promptText.split(/(\[.*?\])/g);
    return parts.map((part, index) => {
      if (part.startsWith("[") && part.endsWith("]")) {
        return (
          <span key={index} className="bg-[#E8DFD0] rounded px-1 font-medium text-[#2C3328]">
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="text-sm text-[#6B6B6B] leading-relaxed border-b border-[#C7C0B5] pb-4">
        {renderPromptPreview()}
      </div>
      
      <div className="flex flex-col gap-3">
        {placeholders.map((ph) => (
          <div key={ph} className="flex flex-col gap-1">
            <label htmlFor={ph} className="text-xs font-semibold text-[#2C3328]">
              {ph}
            </label>
            <input
              id={ph}
              type="text"
              className="border border-[#C7C0B5] rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#E8721A]"
              value={values[ph] || ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [ph]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs font-semibold text-[#6B6B6B] hover:text-[#2C3328] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onFilled(fillTemplate(promptText, values))}
          className="px-4 py-2 text-xs font-semibold bg-[#E8721A] text-white rounded-full hover:bg-[#d66a18] transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}