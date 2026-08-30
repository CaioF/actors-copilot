"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Play, RotateCcw, ChevronRight, User, Video, ShieldCheck, CheckCircle2 } from "lucide-react";

export interface DialogueLine {
  id: number;
  speaker: string;
  isActor: boolean;
  text: string;
}

interface RehearsalRunnerProps {
  sidesText: string;
  roleName: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Parses raw sides script text into a sequence of speaker lines / dialogue turns.
 */
function parseSidesToLines(sidesText: string, roleName: string): DialogueLine[] {
  if (!sidesText || !sidesText.trim()) return [];

  const rawLines = sidesText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const result: DialogueLine[] = [];
  let currentSpeaker = "READER";
  let currentTextBuffer: string[] = [];

  const roleUpper = (roleName || "").trim().toUpperCase();

  const isHeader = (line: string): { isSpeaker: boolean; speakerName: string } => {
    // Look for lines like "CHARACTER NAME:" or ALL CAPS names like "JANE"
    const match = line.match(/^([A-Z0-9\s._'-]{2,30}):?\s*(.*)$/);
    if (match && match[1] && !line.startsWith("SCENE") && !line.startsWith("INT.") && !line.startsWith("EXT.")) {
      const name = match[1].trim();
      const rest = match[2].trim();
      if (name.length > 1 && name.length < 25 && name === name.toUpperCase()) {
        return { isSpeaker: true, speakerName: name };
      }
    }
    return { isSpeaker: false, speakerName: "" };
  };

  rawLines.forEach((line, idx) => {
    const { isSpeaker, speakerName } = isHeader(line);

    if (isSpeaker) {
      if (currentTextBuffer.length > 0) {
        const isActorLine = roleUpper ? currentSpeaker.includes(roleUpper) || roleUpper.includes(currentSpeaker) : false;
        result.push({
          id: result.length + 1,
          speaker: currentSpeaker,
          isActor: isActorLine,
          text: currentTextBuffer.join(" "),
        });
        currentTextBuffer = [];
      }
      currentSpeaker = speakerName;
      // If there was text on the same header line
      const colonIdx = line.indexOf(":");
      if (colonIdx !== -1 && colonIdx < line.length - 1) {
        const rest = line.substring(colonIdx + 1).trim();
        if (rest) currentTextBuffer.push(rest);
      }
    } else {
      currentTextBuffer.push(line);
    }
  });

  if (currentTextBuffer.length > 0) {
    const isActorLine = roleUpper ? currentSpeaker.includes(roleUpper) || roleUpper.includes(currentSpeaker) : false;
    result.push({
      id: result.length + 1,
      speaker: currentSpeaker,
      isActor: isActorLine,
      text: currentTextBuffer.join(" "),
    });
  }

  // Fallback: If parsing found no clear character blocks, treat alternating paragraphs as turns
  if (result.length === 0 && rawLines.length > 0) {
    rawLines.forEach((l, i) => {
      const isActorLine = i % 2 === 0;
      result.push({
        id: i + 1,
        speaker: isActorLine ? (roleName || "YOUR CHARACTER") : "READER",
        isActor: isActorLine,
        text: l,
      });
    });
  }

  return result;
}

export function RehearsalRunner({ sidesText, roleName, isOpen, onClose }: RehearsalRunnerProps) {
  const lines = useMemo(() => parseSidesToLines(sidesText, roleName), [sidesText, roleName]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
    setIsFinished(false);
  }, [isOpen]);

  const handleNext = () => {
    if (currentIndex < lines.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFinished(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, lines.length]);

  if (!isOpen) return null;

  const currentLine = lines[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-3xl h-[85vh] bg-[#2C3328] text-[#E8DFD0] rounded-3xl shadow-2xl overflow-hidden border border-[#4E574B]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#232920] border-b border-[#3B4339]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8721A] text-white">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-title text-base sm:text-lg font-bold text-[#F5F0E8] uppercase tracking-wide">
                Rehearsal Run • {roleName || "Character"}
              </h2>
              <p className="text-xs text-[#A69E90]">
                Actor-led rehearsal • Tap or press Space/Enter to advance cue lines
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3B4339] text-[#A69E90] hover:bg-[#4E574B] hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 overflow-y-auto">
          {isFinished ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center my-auto">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 mb-4">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="font-title text-2xl font-bold text-[#F5F0E8] mb-2">
                Rehearsal Run Complete!
              </h3>
              <p className="text-sm text-[#A69E90] max-w-md mb-6 leading-relaxed">
                You drove the scene, put the lines in your body, and grounded your choices. You are ready to close this runner and take your final audition plan into the tape.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRestart}
                  className="inline-flex items-center gap-2 rounded-full border border-[#4E574B] bg-[#3B4339] hover:bg-[#4E574B] text-white px-5 py-2.5 text-sm font-semibold transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  Run Again
                </button>
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-2 rounded-full bg-[#E8721A] hover:bg-[#d66a18] text-white px-6 py-2.5 text-sm font-bold transition-colors shadow-md"
                >
                  Back to Session
                </button>
              </div>
            </div>
          ) : currentLine ? (
            <div className="flex-1 flex flex-col justify-center my-auto space-y-6">
              {/* Cue Line Speaker Badge */}
              <div className="flex items-center justify-between">
                <div
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    currentLine.isActor
                      ? "bg-[#E8721A] text-white"
                      : "bg-[#4E574B] text-[#E8DFD0]"
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span>{currentLine.isActor ? `YOUR LINE (${currentLine.speaker})` : `READER CUE: ${currentLine.speaker}`}</span>
                </div>
                <span className="text-xs font-mono text-[#A69E90]">
                  Cue {currentIndex + 1} of {lines.length}
                </span>
              </div>

              {/* Dialogue Box */}
              <div
                className={`p-6 sm:p-8 rounded-3xl border transition-all ${
                  currentLine.isActor
                    ? "bg-[#3D463A] border-[#E8721A]/50 shadow-lg text-[#F5F0E8]"
                    : "bg-[#232920] border-[#3B4339] text-[#D1C7B7]"
                }`}
              >
                <p className="text-lg sm:text-2xl font-serif leading-relaxed whitespace-pre-wrap">
                  {currentLine.text}
                </p>
              </div>

              {/* Grounding directive note */}
              <div className="flex items-center gap-2 text-xs text-[#A69E90] italic">
                <ShieldCheck className="h-4 w-4 text-[#E8721A] shrink-0" />
                <span>
                  {currentLine.isActor
                    ? "Deliver your line out loud or to camera with your grounded objective, then tap Next Cue."
                    : "Listen genuinely to the reader cue line landing in your body."}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#A69E90]">
              No dialogue lines detected in the sides text.
            </div>
          )}

          {/* Footer Controls */}
          {!isFinished && (
            <div className="flex items-center justify-between pt-6 border-t border-[#3B4339] mt-6">
              <button
                onClick={handleRestart}
                className="inline-flex items-center gap-1.5 text-xs text-[#A69E90] hover:text-[#F5F0E8] transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restart Scene
              </button>

              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-full bg-[#E8721A] hover:bg-[#d66a18] text-white px-8 py-3 font-bold text-sm transition-all shadow-md hover:shadow-lg"
              >
                <span>{currentIndex === lines.length - 1 ? "Finish Scene Run" : "Next Cue"}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
