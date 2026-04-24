"use client";

import { useState } from "react";
import { ChatInput } from "@/components/chat-input";
import { DashboardHeader } from "@/components/dashboard-header";
import { ActingCoachCitations } from "@/components/acting-coach-citations";
import { useActingCoach } from "@/hooks/use-acting-coach";

export default function ActingCoachPage() {
  const { messages, isLoading, sendMessage } = useActingCoach();
  const [actorName] = useState("ME");

  const handleSend = (content: string) => sendMessage(content);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DashboardHeader title="Acting Coach" />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md text-center">
              <h2 className="mb-4 font-title text-3xl font-bold text-[#2C3328]">
                Your Personal Acting Coach
              </h2>
              <p className="text-[#6B6B6B]">
                Ask me anything about acting techniques, character development,
                audition preparation, or scene analysis. I&apos;ll draw from our
                library of acting resources to give you grounded, practical
                advice.
              </p>
            </div>
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

      <ChatInput onSend={handleSend} isLoading={isLoading} />

      <div className="px-8 py-2 text-center">
        <p className="text-xs text-[#6B6B6B]/60">
          Responses are grounded in our acting library.{" "}
          {actorName !== "ME" && `Speaking with ${actorName}.`}
        </p>
      </div>
    </div>
  );
}