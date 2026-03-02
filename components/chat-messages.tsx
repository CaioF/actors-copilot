"use client";

import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatMessage } from "@/lib/chat-types";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  streamingContent: string;
  isInitializing: boolean;
}

function formatTime(timestamp: ChatMessage["timestamp"]): string {
  if (!timestamp) return "2:30PM";
  try {
    const date = new Date(
      (timestamp as unknown as { seconds: number }).seconds * 1000
    );
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "2:30PM";
  }
}

function CopilotAvatar() {
  return (
    <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-full border border-[#F5F0E8]/20 bg-[#2C3328]">
      <span className="text-[4px] font-medium uppercase tracking-wider text-[#F5F0E8]/70">
        The
      </span>
      <span className="font-sans text-[7px] font-extrabold uppercase leading-none tracking-wide text-[#F5F0E8]">
        Actors
      </span>
      <span className="text-[4px] font-medium uppercase tracking-wider text-[#F5F0E8]/70">
        Copilot
      </span>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";

  return (
    <div
      className={`flex gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}
    >
      {isAssistant && (
        <div className="mt-auto mb-2">
          <CopilotAvatar />
        </div>
      )}

      <div className={`flex max-w-[65%] flex-col ${isAssistant ? "items-start" : "items-end"}`}>
        <div
          className={`rounded-2xl px-6 py-5 ${
            isAssistant
              ? "bg-[#FEFDFB] text-[#2C3328] shadow-sm"
              : "bg-[#3D4A3C] text-[#F5F0E8]"
          }`}
        >
          <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
            {message.content.split("\n").map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </div>
        </div>
        <span className="mt-1.5 text-xs text-[#6B6B6B]">
          {formatTime(message.timestamp)}
        </span>
      </div>

      {!isAssistant && (
        <div className="mt-auto mb-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-[#4A5548] text-xs text-[#F5F0E8]">
              AS
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start gap-3">
      <div className="mt-auto mb-2">
        <CopilotAvatar />
      </div>
      <div className="flex max-w-[65%] flex-col items-start">
        <div className="rounded-2xl bg-[#FEFDFB] px-6 py-5 shadow-sm ring-1 ring-[#E8721A]/20 animate-pulse">
          <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#2C3328]">
            {content}
            <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-[#E8721A]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start gap-3">
      <div className="mt-auto mb-2">
        <CopilotAvatar />
      </div>
      <div className="rounded-2xl bg-[#FEFDFB] px-6 py-4 shadow-sm">
        <div className="flex gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#6B6B6B]/50 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#6B6B6B]/50 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#6B6B6B]/50 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-12 py-8">
      <div className="flex justify-start gap-3">
        <Skeleton className="h-9 w-9 rounded-full bg-[#E8DFD0]" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-80 rounded-lg bg-[#E8DFD0]" />
          <Skeleton className="h-4 w-64 rounded-lg bg-[#E8DFD0]" />
          <Skeleton className="h-4 w-48 rounded-lg bg-[#E8DFD0]" />
        </div>
      </div>
      <div className="flex justify-start gap-3">
        <Skeleton className="h-9 w-9 rounded-full bg-[#E8DFD0]" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-72 rounded-lg bg-[#E8DFD0]" />
          <Skeleton className="h-4 w-56 rounded-lg bg-[#E8DFD0]" />
        </div>
      </div>
    </div>
  );
}

export function ChatMessages({
  messages,
  isLoading,
  streamingContent,
  isInitializing,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, isLoading]);

  if (isInitializing) {
    return (
      <div className="flex-1 overflow-y-auto">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-6 px-12 py-8">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && streamingContent && (
          <StreamingBubble content={streamingContent} />
        )}
        {isLoading && !streamingContent && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
