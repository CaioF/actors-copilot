"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, Plus, Paperclip, Sparkles, UserCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ChatInput } from "@/components/chat-input";
import { DashboardHeader } from "@/components/dashboard-header";
import { QuickPromptsDropdown } from "@/components/quick-prompts-dropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActingCoach } from "@/hooks/use-acting-coach";
import type { AttachedDocument } from "@/components/chat-input";
import type { CoachSession } from "@/lib/chat-types";
import { renderMarkdown } from "@/lib/acting-coach/render-markdown";
import { FlightPlan } from "@/components/acting-coach/flight-plan";
import { RehearsalRunner } from "@/components/acting-coach/rehearsal-runner";
import { AuditionPlanCard } from "@/components/acting-coach/audition-plan-card";
import type { FlightPlanStage } from "@/lib/acting-coach/contracts";

const COACH_DESCRIPTION =
  "Ask anything about your character, your audition, your career, or the industry. Get guidance on performance, self-tapes, casting, agents, mindset, and next steps in your career. All in a private space that is yours, whenever you need it.";

function sessionLabel(s: Pick<CoachSession, "sessionFocus" | "title" | "coachType">): string {
  const prefix = s.coachType === "character" ? "Character Coach • " : "";
  return prefix + (s.sessionFocus?.trim() || s.title?.trim() || "New Session");
}

function relativeTime(ts: CoachSession["lastActiveAt"]): string {
  if (!ts) return "just now";
  try {
    const seconds = (ts as { seconds?: number }).seconds;
    if (typeof seconds !== "number") return "";
    return formatDistanceToNow(new Date(seconds * 1000), { addSuffix: true });
  } catch {
    return "";
  }
}

export default function ActingCoachPage() {
  const {
    messages,
    isLoading,
    sendMessage,
    startNewSession,
    switchSession,
    selectStage,
    setCoachType,
    session,
    sessions = [],
    sessionId,
    isAuthenticated,
  } = useActingCoach();

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const searchParams = useSearchParams();
  const auditionId = searchParams.get("auditionId");

  const project = searchParams.get("project") || "this project";
  const role = searchParams.get("role") || "the character";
  const analysisType = searchParams.get("analysisType"); // "sides" | "brief" | null

  const hasFiredInitialMessage = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [pendingInitialMessage, setPendingInitialMessage] = useState(false);
  const [isRunnerOpen, setIsRunnerOpen] = useState(false);

  const isCharacterCoach = session?.coachType === "character" || Boolean(auditionId);

  // Opening prompt sent on behalf of the actor when initializing Character Coach for an audition
  const buildStarterMessage = (): string => {
    if (isCharacterCoach) {
      return `I'm ready to work on my ${project} audition as ${role}. Let's start Stage 1 of the Flight Plan.`;
    }
    if (analysisType === "brief") {
      return `Help me build the character for my ${project} audition (role: ${role}). Walk me through what the casting brief tells us — start with who this character is and what the casting team seems to want.`;
    }
    if (analysisType === "sides") {
      return `I want to rehearse my sides for my ${project} audition as ${role}. Where should we start — should we read through the objective and beats first, or jump straight into a tactic?`;
    }
    return `I want to work on my ${project} audition as ${role}.`;
  };

  // Auto-trigger session context if coming from a specific audition.
  useEffect(() => {
    if (auditionId && !hasFiredInitialMessage.current && isAuthenticated) {
      void (async () => {
        try {
          await startNewSession({ linkedAuditionId: auditionId, coachType: "character" });
          hasFiredInitialMessage.current = true;
          setPendingInitialMessage(true);
        } catch {
          // Retry on next cycle
        }
      })();
    }
  }, [auditionId, isAuthenticated, startNewSession]);

  useEffect(() => {
    if (pendingInitialMessage && session?.linkedAuditionId === auditionId) {
      setPendingInitialMessage(false);
      sendMessage(buildStarterMessage(), auditionId ?? undefined, null, { coachType: "character" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInitialMessage, session, auditionId, project, role, analysisType, sendMessage]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      if (typeof container.scrollTo === "function") {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleSend = (content: string, document?: AttachedDocument | null) => {
    const currentAuditionId = session?.linkedAuditionId || auditionId || undefined;
    sendMessage(content, currentAuditionId, document, { coachType: session?.coachType || "general" });
  };

  const handleSelectStage = (stageNum: FlightPlanStage) => {
    selectStage(stageNum);
    const currentAuditionId = session?.linkedAuditionId || auditionId || undefined;
    sendMessage(`Let's jump to Stage ${stageNum}.`, currentAuditionId, null, {
      coachType: "character",
      targetStage: stageNum,
    });
  };

  const isEmpty = messages.length === 0 && !isLoading;

  const headerTitleText = session?.title ? `Acting Coach — ${session.title}` : "Acting Coach";
  const headerTitleSlot = sessions.length > 0 ? (
    <div className="flex min-w-0 flex-col md:flex-row md:items-center gap-0 md:gap-3">
      <div className="flex items-center gap-2">
        <h1 className="font-title text-xl md:text-3xl font-bold text-foreground truncate">
          {isCharacterCoach ? "Character Coach" : "General Coach"}
        </h1>
        <span className="hidden md:inline font-title text-3xl font-bold text-muted-foreground/60">—</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="group inline-flex min-w-0 max-w-[200px] sm:max-w-md md:max-w-full items-center gap-2 rounded-lg md:px-2 py-1 text-left transition-colors hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="truncate font-title text-base sm:text-xl md:text-3xl font-bold text-foreground">
            {session ? sessionLabel(session) : "Select a session"}
          </span>
          {session?.lastActiveAt && (
            <span className="hidden lg:inline shrink-0 text-sm font-medium text-muted-foreground">
              {relativeTime(session.lastActiveAt)}
            </span>
          )}
          <ChevronDown className="h-4 w-4 md:h-5 md:w-5 shrink-0 text-primary transition-transform group-data-[state=open]:rotate-180" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-80 w-80 overflow-y-auto border-border bg-popover text-popover-foreground"
        >
          {sessions.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onSelect={() => switchSession(s.id)}
              className={`flex flex-col items-start gap-0.5 focus:bg-accent focus:text-accent-foreground ${s.id === sessionId ? "bg-accent/80 text-accent-foreground" : ""}`}
            >
              <span className="w-full truncate text-sm font-semibold text-foreground">
                {sessionLabel(s)}
              </span>
              <span className="text-xs text-muted-foreground">
                {relativeTime(s.lastActiveAt)}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DashboardHeader title={headerTitleText} titleSlot={headerTitleSlot} className="mb-0 border-b border-border" />

      {/* Coach Mode Switcher Bar */}
      <div className="bg-card/80 border-b border-border px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 transition-colors">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCoachType("character")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              isCharacterCoach
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Character Coach (Role Focus)
          </button>
          <button
            onClick={() => setCoachType("general")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              !isCharacterCoach
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            24/7 General Coach
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => startNewSession({ coachType: isCharacterCoach ? "character" : "general" })}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            New Session
          </button>
        </div>
      </div>

      {/* Flight Plan Navigation Bar (rendered when in Character Coach mode) */}
      {isCharacterCoach && (
        <FlightPlan
          currentStage={(session?.currentStage as FlightPlanStage) || 1}
          completedStages={session?.completedStages || []}
          flightPlanMode={session?.flightPlanMode || "guided"}
          onSelectStage={handleSelectStage}
          onOpenRunner={() => setIsRunnerOpen(true)}
        />
      )}

      {/* Scrollable messages region */}
      <div ref={scrollContainerRef} className="relative min-h-0 flex-1 overflow-y-auto px-4 sm:px-8">
        {!isEmpty && (
          <div className="pointer-events-none sticky top-0 z-10 flex justify-end pt-2">
            <div className="pointer-events-auto">
              <QuickPromptsDropdown onSelect={(text) => sendMessage(text, session?.linkedAuditionId || auditionId || undefined, null, { coachType: session?.coachType || "general" })} />
            </div>
          </div>
        )}
        {isEmpty ? (
          <div className="flex h-full items-center justify-center py-8">
            <div className="flex max-w-md flex-col items-center text-center">
              <Image
                src="/logo.png"
                alt="The Actors Copilot"
                width={120}
                height={120}
                className="object-contain"
                priority
              />
              <h3 className="mt-6 font-title text-xl font-bold text-[#2C3328]">
                {isCharacterCoach ? "Character Coach Ready." : "Your 24/7 Coach is ready."}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
                {isCharacterCoach
                  ? "Takes your completed breakdown and coaches you step-by-step through the 10-stage Flight Plan until you are ready to press record."
                  : COACH_DESCRIPTION}
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl space-y-6 py-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-5 py-4 ${
                    msg.role === "user"
                      ? "bg-[#E8721A] text-white"
                      : "bg-[#E8DFD0] text-[#2C3328] shadow-sm"
                  }`}
                >
                  {msg.role === "user" ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.documentName && (
                        <div className="flex items-center gap-1.5 self-end rounded-md bg-[#D66818] px-2 py-1 text-xs font-medium text-[#F5F0E8]/90">
                          <Paperclip className="h-3 w-3" />
                          <span className="truncate max-w-[150px] sm:max-w-[200px]">{msg.documentName}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm space-y-3">
                      {renderMarkdown(msg.content)}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Stage 10 Audition Plan Card output */}
            {session?.auditionPlan && (
              <AuditionPlanCard
                plan={session.auditionPlan}
                roleName={role}
                projectName={project}
              />
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-[#E8DFD0] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-[#E8721A]" />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-[#E8721A]" style={{ animationDelay: "0.1s" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-[#E8721A]" style={{ animationDelay: "0.2s" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Fixed quick prompts (only on empty state) */}
      {isEmpty && (
        <div className="flex justify-center pb-4">
          <QuickPromptsDropdown onSelect={(text) => sendMessage(text, session?.linkedAuditionId || auditionId || undefined, null, { coachType: session?.coachType || "general" })} />
        </div>
      )}

      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        placeholder={isCharacterCoach ? "Talk to your Character Coach..." : "Talk to your coach..."}
        messages={messages}
        sessionId={session?.id}
      />

      {/* Rehearsal Runner Modal */}
      <RehearsalRunner
        sidesText={session?.sidesText || ""}
        roleName={role}
        isOpen={isRunnerOpen}
        onClose={() => setIsRunnerOpen(false)}
      />
    </div>
  );
}