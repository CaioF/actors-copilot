"use client";

import { useState } from "react";
import { ChevronDown, MessageSquareText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { QUICK_PROMPTS, QUICK_PROMPT_CATEGORIES } from "@/lib/quick-prompts";
import { PlaceholderFillForm } from "@/components/placeholder-fill-form";

/**
 * Props for the QuickPromptsDropdown component.
 */
interface QuickPromptsDropdownProps {
  /** Callback fired when a prompt text is finalized and selected. */
  onSelect: (text: string) => void;
}

/**
 * A searchable dropdown menu containing categorized quick prompts for the Acting Coach.
 * Improved for readability, text wrapping, and precise CMDK fuzzy filtering.
 */
export function QuickPromptsDropdown({ onSelect }: QuickPromptsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [fillingPrompt, setFillingPrompt] = useState<{ id: string; text: string } | null>(null);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(() => setFillingPrompt(null), 200);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 text-sm font-semibold text-[#6B6B6B] border border-[#C7C0B5] bg-transparent hover:bg-[#E8DFD0] hover:text-[#2C3328] px-6 py-2.5 rounded-full transition-all shadow-sm"
          aria-label="Quick Prompts"
        >
          Quick Prompts <ChevronDown className="h-4 w-4 opacity-70" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[560px] max-w-[calc(100vw-2rem)] p-0 border border-[#C7C0B5] shadow-2xl rounded-xl bg-white" align="end" sideOffset={12} collisionPadding={16}>
        {fillingPrompt ? (
          <PlaceholderFillForm
            promptText={fillingPrompt.text}
            onFilled={(filledText) => {
              onSelect(filledText);
              handleOpenChange(false);
            }}
            onCancel={() => setFillingPrompt(null)}
          />
        ) : (
          <Command className="bg-transparent">
            <CommandInput
              placeholder="Search prompts..."
              className="text-sm border-b border-[#C7C0B5] px-4 py-3"
            />
            <CommandList className="max-h-[420px] overflow-y-auto p-2">
              <CommandEmpty className="py-6 text-center text-sm text-[#6B6B6B]">
                No prompts found
              </CommandEmpty>

              {QUICK_PROMPT_CATEGORIES.map((category) => {
                const prompts = QUICK_PROMPTS.filter((p) => p.category === category.id);

                if (prompts.length === 0) return null;

                return (
                  <CommandGroup
                    key={category.id}
                    heading={category.label}
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-[#E8721A]"
                  >
                    {prompts.map((prompt) => (
                      <CommandItem
                        key={prompt.id}
                        // Value must be the text so CMDK fuzzy search works correctly
                        value={prompt.text}
                        onSelect={() => {
                          if (prompt.placeholderKeys.length > 0) {
                            setFillingPrompt({ id: prompt.id, text: prompt.text });
                          } else {
                            onSelect(prompt.text);
                            handleOpenChange(false);
                          }
                        }}
                        // Tailwind aria-selected handles the active/hover state from CMDK
                        className="flex items-start gap-3 px-3 py-3 my-1 cursor-pointer rounded-lg aria-selected:bg-[#E8DFD0] aria-selected:text-[#2C3328] transition-colors"
                      >
                        <MessageSquareText className="h-4 w-4 mt-0.5 opacity-50 shrink-0" />
                        <span className="text-sm text-[#2C3328] whitespace-normal leading-relaxed text-left">
                          {prompt.text}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );

}