"use client";

import { X, Sparkles, BookOpen, Upload, Award, Layers } from "lucide-react";
import { DNA_CHAPTERS } from "@/lib/chat-types";

interface ChatHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUpload?: () => void;
}

/**
 * ChatHelpModal Component
 * Provides an interactive, easy-to-understand explanation of the DNA Extraction process,
 * detailing the 4 Chapters, unlock milestones, deep analysis approach, and baseline upload fast-track.
 */
export function ChatHelpModal({ isOpen, onClose, onOpenUpload }: ChatHelpModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-card border border-border p-6 sm:p-8 shadow-2xl text-card-foreground transition-colors custom-scrollbar space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close help modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div>
          <h2 className="font-title text-2xl font-bold text-foreground">
            How DNA Extraction Works
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Building your psychological actor archive for authentic performances
          </p>
        </div>

        <div className="border-t border-border/60 pt-4 space-y-4 text-sm text-muted-foreground leading-relaxed">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
              1. The Goal
            </h3>
            <p>
              Great acting draws from specific, lived sensory truths. This engine uncovers your personal turning points, emotional triggers, and core values so your AI Acting Coach can tailor audition notes directly to your persona.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
              2. Quality & Depth (Work At Your Pace)
            </h3>
            <p>
              This is a deep analysis of who you are. You do not need to finish everything at once—complete one chapter per session whenever you log in.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">
              3. The 4 Chapters
            </h3>
            <ul className="space-y-1 text-xs text-foreground/90 pl-1">
              <li>• <span className="font-semibold text-foreground">Chapter 1:</span> Identity & Formative Roots *(Unlocks Audition Prep)*</li>
              <li>• <span className="font-semibold text-foreground">Chapter 2:</span> Relational Power & Authority *(Unlocks Archetype Matching)*</li>
              <li>• <span className="font-semibold text-foreground">Chapter 3:</span> Inner Shadow & Defense Mechanics *(Unlocks Trigger Analysis)*</li>
              <li>• <span className="font-semibold text-foreground">Chapter 4:</span> Core Fuel & Vitality *(Full Master Profile)*</li>
            </ul>
          </div>
        </div>

        {/* Fast Track Box */}
        <div className="rounded-2xl bg-muted/30 border border-border/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-semibold text-foreground">Want to jumpstart your Vault?</p>
            <p className="text-muted-foreground">Upload a bio, journal entry, or resume to extract your baseline immediately.</p>
          </div>
          {onOpenUpload && (
            <button
              onClick={() => {
                onClose();
                onOpenUpload();
              }}
              className="shrink-0 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              Upload Baseline
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 text-right">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
