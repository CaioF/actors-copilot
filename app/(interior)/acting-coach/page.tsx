"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronDown, Plus } from "lucide-react";
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

const COACH_DESCRIPTION =
  "Ask anything about your character, your audition, your career, or the industry. Get guidance on performance, self-tapes, casting, agents, mindset, and next steps in your career. All in a private space that is yours, whenever you need it.";

function sessionLabel(s: Pick<CoachSession, "sessionFocus" | "title">): string {
  return s.sessionFocus?.trim() || s.title?.trim() || "New Session";
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
    session,
    sessions = [],
    sessionId,
  } = useActingCoach();
  
  const searchParams = useSearchParams();
  const auditionId = searchParams.get("auditionId");
  const project = searchParams.get("project");
  const role = searchParams.get("role");

  const hasFiredInitialMessage = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-trigger session context if coming from a specific audition
  useEffect(() => {
    if (auditionId && project && role && !hasFiredInitialMessage.current) {
      hasFiredInitialMessage.current = true;
      sendMessage(
        `I want to work on my ${project} audition as ${role}.`,
        auditionId
      );
    }
  }, [auditionId, project, role, sendMessage]);

  // Auto-scroll to latest message on new messages, loading state, and session load
  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSend = (content: string, document?: AttachedDocument | null) =>
    sendMessage(content, undefined, document);

  const isEmpty = messages.length === 0 && !isLoading;

  const headerTitleText = session?.title ? `Acting Coach — ${session.title}` : "Acting Coach";
  const headerTitleSlot = sessions.length > 0 ? (
    <div className="flex min-w-0 items-center gap-3">
      <h1 className="font-title text-3xl font-bold text-[#2C3328]">Acting Coach</h1>
      <span className="font-title text-3xl font-bold text-[#2C3328]/60">—</span>
      <DropdownMenu>
        <DropdownMenuTrigger className="group inline-flex min-w-0 max-w-full items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-[#7A9098] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2C3328]/40">
          <span className="truncate font-title text-3xl font-bold text-[#2C3328]">
            {session ? sessionLabel(session) : "Select a session"}
          </span>
          {session?.lastActiveAt && (
            <span className="shrink-0 text-sm font-medium text-[#2C3328]/50">
              {relativeTime(session.lastActiveAt)}
            </span>
          )}
          <ChevronDown className="h-5 w-5 shrink-0 text-[#E8721A] transition-transform group-data-[state=open]:rotate-180" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-80 w-80 overflow-y-auto border-[#7A9098] bg-[#8BA2A8] text-[#2C3328]"
        >
          {sessions.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onSelect={() => switchSession(s.id)}
              className={`flex flex-col items-start gap-0.5 focus:bg-[#7A9098] focus:text-[#2C3328] ${s.id === sessionId ? "bg-[#7A9098]" : ""}`}
            >
              <span className="w-full truncate text-sm font-semibold text-[#2C3328]">
                {sessionLabel(s)}
              </span>
              <span className="text-xs text-[#2C3328]/55">
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
      <DashboardHeader title={headerTitleText} titleSlot={headerTitleSlot} />

      {/* Fixed title row */}
      <div className="flex items-center justify-between gap-4 px-8 pt-2 pb-6">
        <p className="text-sm text-[#6B6B6B]">
          Your coach is ready. What are we working on?
        </p>
        <button
          onClick={() => startNewSession()}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#E8721A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d66a18]"
        >
          <Plus className="h-4 w-4" />
          New Session
        </button>
      </div>

      {/* Scrollable messages region (relative for floating quick-prompts trigger) */}
      <div className="relative min-h-0 flex-1 overflow-y-auto px-8">
        {!isEmpty && (
          <div className="pointer-events-none sticky top-0 z-10 flex justify-end pt-2">
            <div className="pointer-events-auto">
              <QuickPromptsDropdown onSelect={(text) => sendMessage(text)} />
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
                Your coach is ready.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
                {COACH_DESCRIPTION}
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
                  className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                    msg.role === "user"
                      ? "bg-[#E8721A] text-white"
                      : "bg-[#E8DFD0] text-[#2C3328] shadow-sm"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="text-sm">
                      {renderMarkdown(msg.content)}
                    </div>
                  )}
                </div>
              </div>
            ))}
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
          <QuickPromptsDropdown onSelect={(text) => sendMessage(text)} />
        </div>
      )}

      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        placeholder="Talk to your coach..."
        messages={messages}
        sessionId={session?.id}
      />
    </div>
  );
}