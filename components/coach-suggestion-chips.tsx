import React from "react";

export const SUGGESTIONS: { label: string; prompt: string }[] = [
  { label: "Help me deepen my objective", prompt: "Help me deepen my objective" },
  { label: "I just got a redirect - what do I do?", prompt: "I just got a redirect - what do I do?" },
  { label: "I'm spiraling before an audition", prompt: "I'm spiraling before an audition" },
  { label: "Apply this to my DNA", prompt: "Apply this to my DNA" },
];

interface CoachSuggestionChipsProps {
  onSelect?: ((prompt: string) => void) | undefined;
}

export function CoachSuggestionChips({ onSelect }: CoachSuggestionChipsProps) {
  if (onSelect === undefined) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion.label}
          onClick={() => onSelect(suggestion.prompt)}
          disabled={!onSelect}
          className="text-xs font-semibold text-[#6B6B6B] border border-[#C7C0B5] bg-transparent hover:bg-[#E8DFD0] hover:text-[#2C3328] px-5 py-2 rounded-full transition-colors disabled:opacity-50"
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}
