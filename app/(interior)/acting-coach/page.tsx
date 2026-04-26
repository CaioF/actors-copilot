"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ChatInput } from "@/components/chat-input";
import { DashboardHeader } from "@/components/dashboard-header";
import { CoachSuggestionChips } from "@/components/coach-suggestion-chips";
import { useActingCoach } from "@/hooks/use-acting-coach";

const COACH_DESCRIPTION =
  "Ask anything about your character, your audition, your career, or the industry. Get guidance on performance, self-tapes, casting, agents, mindset, and next steps in your career. All in a private space that is yours, whenever you need it.";

export default function ActingCoachPage() {
  const { messages, isLoading, sendMessage, clearSession } = useActingCoach();
  const searchParams = useSearchParams();

  const auditionId = searchParams.get("auditionId");
  const project = searchParams.get("project");
  const role = searchParams.get("role");

  const hasFiredInitialMessage = useRef(false);

  useEffect(() => {
    if (auditionId && project && role && !hasFiredInitialMessage.current) {
      hasFiredInitialMessage.current = true;
      sendMessage(
        `I want to work on my ${project} audition as ${role}.`,
        auditionId
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = (content: string) => sendMessage(content);
  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader title="Acting Coach" />

      <div className="flex flex-1 flex-col px-8">
        <div className="flex items-start justify-between pt-2 pb-6">
          <div>
            <h2 className="font-title text-2xl font-bold text-[#2C3328]">Acting Coach</h2>
            <p className="mt-1 text-sm text-[#6B6B6B]">
              Your coach is ready. What are we working on?
            </p>
          </div>
          <button
            onClick={clearSession}
            className="inline-flex items-center gap-2 rounded-full bg-[#E8721A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#d66a18]"
          >
            <Plus className="h-4 w-4" />
            New Session
          </button>
        </div>

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
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-[#E8721A] text-white"
                        : "bg-[#E8DFD0] text-[#2C3328]"
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-[#E8DFD0] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-[#E8721A]" />
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-[#E8721A]"
                        style={{ animationDelay: "0.1s" }}
                      />
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-[#E8721A]"
                        style={{ animationDelay: "0.2s" }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {isEmpty && (
          <div className="flex justify-center pb-4">
            <CoachSuggestionChips onSelect={sendMessage} />
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
