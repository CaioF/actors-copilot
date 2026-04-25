"use client";

import { Sparkles } from "lucide-react";
import { ChatInput } from "@/components/chat-input";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardFooter } from "@/components/dashboard-footer";
import { ActingCoachCitations } from "@/components/acting-coach-citations";
import { CoachSuggestionChips } from "@/components/coach-suggestion-chips";
import { useActingCoach } from "@/hooks/use-acting-coach";

const WELCOME_COACH_MESSAGE =
  "Welcome to your Acting Coach. I'm here to help you with scene work, character development, audition prep, and career guidance — grounded in a library of acting resources. Ask me anything, or tap a suggestion below to get started.";

export default function ActingCoachPage() {
  const { messages, isLoading, sendMessage, clearSession } = useActingCoach();

  const handleSend = (content: string) => sendMessage(content);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DashboardHeader title="Acting Coach" />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-4">
          <p className="text-sm text-[#6B6B6B]">Your coach is ready. What are we working on?</p>
          {messages.length > 0 && (
            <button
              onClick={clearSession}
              className="mt-2 rounded bg-[#E8721A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#d66a18]"
            >
              New Session
            </button>
          )}
        </div>

        {messages.length === 0 && !isLoading ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl bg-[#E8DFD0] px-4 py-4">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#E8721A]" />
              <p className="text-sm text-[#2C3328]">{WELCOME_COACH_MESSAGE}</p>
            </div>
            <p className="text-xs text-[#6B6B6B]">Just now</p>
            <CoachSuggestionChips onSelect={sendMessage} />
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
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
                  {msg.role === "assistant" && msg.citations && (
                    <ActingCoachCitations citations={msg.citations} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="mx-auto max-w-2xl">
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl bg-[#E8DFD0] px-4 py-3">
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
          </div>
        )}
      </div>

      <ChatInput onSend={handleSend} isLoading={isLoading} placeholder="Talk to your coach..." />

      <DashboardFooter />
    </div>
  );
}
