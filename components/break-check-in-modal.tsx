"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Coffee, ArrowRight, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface BreakCheckInModalProps {
  /**
   * Controls modal visibility.
   */
  isOpen: boolean;
  /**
   * Callback fired when the user chooses to continue their session or dismisses the modal.
   */
  onKeepGoing: () => void;
  /**
   * Optional custom callback when the user chooses to take a break.
   * By default, it will navigate the user to `/dashboard`.
   */
  onTakeBreak?: () => void;
}

/**
 * BreakCheckInModal component for prompting users after extended focus sessions.
 * Grounded, warm, and supportive UI designed specifically for actors engaged in deep prep work.
 */
export function BreakCheckInModal({
  isOpen,
  onKeepGoing,
  onTakeBreak,
}: BreakCheckInModalProps) {
  const router = useRouter();

  const handleTakeBreak = () => {
    onKeepGoing();
    if (onTakeBreak) {
      onTakeBreak();
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onKeepGoing(); }}>
      <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border/60 shadow-2xl rounded-3xl p-6 sm:p-8 transition-colors">
        <DialogHeader className="flex flex-col items-center text-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8721A]/15 text-[#E8721A] ring-8 ring-[#E8721A]/5">
            <Coffee className="h-7 w-7" />
          </div>
          <div className="space-y-1 mt-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground mb-2">
              <Sparkles className="h-3 w-3 text-[#E8721A]" />
              <span>15-Minute Rehearsal Check-In</span>
            </div>
            <DialogTitle className="font-title text-2xl font-bold tracking-tight text-foreground">
              Time for a breather?
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed text-center max-w-sm">
            You&apos;ve been doing deep, focused work for the last 15 minutes. Acting prep can be emotionally and mentally demanding — feel free to step away for a glass of water, stretch, or take a quick breath.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 mt-6 sm:justify-stretch">
          <button
            type="button"
            onClick={onKeepGoing}
            className="w-full sm:w-1/2 py-2.5 px-4 text-sm font-semibold rounded-full border border-border bg-card hover:bg-muted text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Keep Going
          </button>
          <button
            type="button"
            onClick={handleTakeBreak}
            className="w-full sm:w-1/2 py-2.5 px-4 text-sm font-semibold rounded-full bg-[#E8721A] hover:bg-[#d66818] text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#E8721A] focus:ring-offset-2"
          >
            <span>Take a Break</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
