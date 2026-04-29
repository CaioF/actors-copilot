"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Plus, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ChatInput } from "@/components/chat-input";
import { DashboardHeader } from "@/components/dashboard-header";
import { QuickPromptsDropdown } from "@/components/quick-prompts-dropdown";
import { useActingCoach } from "@/hooks/use-acting-coach";
import type { AttachedDocument } from "@/components/chat-input";
import { renderMarkdown } from "@/lib/acting-coach/render-markdown";

const COACH_DESCRIPTION =
  "Ask anything about your character, your audition, your career, or the industry. Get guidance on performance, self-tapes, casting, agents, mindset, and next steps in your career. All in a private space that is yours, whenever you need it.";

export default function ActingCoachPage() {
  const { 
    messages, 
    isLoading, 
    sendMessage, 
    startNewSession, 
    clearSessionFocus, 
    session 
  } = useActingCoach();
  
  const searchParams = useSearchParams();
  const auditionId = searchParams.get("auditionId");
  const project = searchParams.get("project");
  const role = searchParams.get("role");

  const hasFiredInitialMessage = useRef(false);

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

  const handleSend = (content: string, document?: AttachedDocument | null) => 
    sendMessage(content, undefined, document);

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader 
        title={session?.title ? `Acting Coach — ${session.title}` : "Acting Coach"} 
      />

      <div className="flex flex-1 flex-col px-8">
        <div className="flex items-start justify-between pt-2 pb-6">
          <div>
            <p className="mt-1 text-sm text-[#6B6B6B]">
              Your coach is ready. What are we working on?
            </p>
          </div>
          <button
            onClick={() => startNewSession()}
            className="inline-flex items-center gap-2 rounded-full bg-[#E8721A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d66a18]"
          >
            <Plus className="h-4 w-4" />
            New Session
          </button>
        </div>

        {/* Session Focus Indicator */}
        {session?.sessionFocus && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-[#E8DFD0] bg-[#F9F7F2] px-4 py-3 text-sm text-[#2C3328]">
            
            <p><span className="font-bold text-[#E8721A]">Currently working on:</span> {session.sessionFocus}</p>
            <button 
              onClick={clearSessionFocus}
              aria-label="Clear current focus"
              className="text-[#6B6B6B] hover:text-[#2C3328]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex flex-1 flex-col">
          {isEmpty ? (
            <div className="flex flex-1 items-center justify-center py-8">
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
            </div>
          )}
        </div>

        {isEmpty && (
          <div className="flex justify-center pb-4">
            <QuickPromptsDropdown onSelect={(text) => sendMessage(text)} />
          </div>
        )}
      </div>

      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        placeholder="Talk to your coach..."
      />
    </div>
  );
}