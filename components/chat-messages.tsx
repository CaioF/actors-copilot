"use client";

import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatMessage } from "@/lib/chat-types";
import { AiThinkingBlock } from "./ai-thinking-block";
import { FileText } from "lucide-react";
import { renderMarkdown } from "@/lib/render-markdown";
import { ChatIntroCard } from "./chat-intro-card";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  streamingContent: string;
  isInitializing: boolean;
  isReprocessing?: boolean;
  actorName?: string;
  activeSection?: string;
}

export function getInitials(name?: string) {
  if (!name) return "ME";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Formats a timestamp into a human-readable time string.
 * @param timestamp - The timestamp to format
 * @returns Formatted time string (e.g., "2:30PM")
 */
export function formatTime(timestamp: ChatMessage["timestamp"]): string {
  if (!timestamp) return "2:30PM";
  try {
    const ts = timestamp as unknown as { seconds: number } | number;
    const ms = typeof ts === "number" ? ts : ts.seconds * 1000;
    const date = new Date(ms);
    if (isNaN(date.getTime())) return "2:30PM";
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "2:30PM";
  }
}

/**
 * Renders the Copilot avatar icon with dynamic design tokens.
 * @returns The Copilot avatar JSX element
 */
function CopilotAvatar() {
  return (
    <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-full border border-border bg-card shadow-sm">
      <span className="text-[4px] font-medium uppercase tracking-wider text-muted-foreground">
        The
      </span>
      <span className="font-sans text-[7px] font-extrabold uppercase leading-none tracking-wide text-foreground">
        Actors
      </span>
      <span className="text-[4px] font-medium uppercase tracking-wider text-muted-foreground">
        Copilot
      </span>
    </div>
  );
}

/**
 * Renders a chat message bubble supporting light/dark theme tokens.
 * @param props - Component props
 * @returns The message bubble JSX element
 */
function MessageBubble({
  message,
  userInitials,
  isFirstAssistantMessage = false,
  activeSection,
}: {
  message: ChatMessage & { attachmentName?: string };
  userInitials: string;
  isFirstAssistantMessage?: boolean;
  activeSection?: string;
}) {
  const isAssistant = message.role === "assistant";

  // Renders the Hero Intro Card for the initial assistant message
  if (isAssistant && isFirstAssistantMessage && activeSection === "identity") {
    return <ChatIntroCard content={message.content} />;
  }

  return (
    <div className={`flex gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}>
      {isAssistant && (
        <div className="mt-auto mb-2">
          <CopilotAvatar />
        </div>
      )}

      <div className={`flex max-w-[70%] flex-col ${isAssistant ? "items-start" : "items-end"}`}>
        <div
          className={`rounded-2xl px-6 py-4 shadow-sm border ${isAssistant
            ? "bg-card text-card-foreground border-border"
            : "bg-primary text-primary-foreground border-transparent"
            }`}
        >
          {!isAssistant && message.attachmentName && (
            <div className="flex items-center gap-1.5 rounded-md bg-primary-foreground/15 px-2.5 py-1.5 mb-3 w-fit border border-primary-foreground/20">
              <FileText size={12} className="text-primary-foreground/80" />
              <span className="text-[11px] font-medium text-primary-foreground truncate max-w-[180px]">
                {message.attachmentName}
              </span>
            </div>
          )}

          <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
            {isAssistant ? (
              renderMarkdown(message.content)
            ) : (
              message.content.split("\n").map((line, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))
            )}
          </div>
        </div>
        <span className="mt-1.5 text-xs text-muted-foreground">
          {formatTime(message.timestamp)}
        </span>
      </div>

      {!isAssistant && (
        <div className="mt-auto mb-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
}

/**
 * Renders a streaming message bubble with pulsing indicator.
 * @param props - Component props
 * @returns Streaming bubble JSX element
 */
function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-start gap-3">
      <div className="mt-auto mb-2">
        <CopilotAvatar />
      </div>
      <div className="flex max-w-[70%] flex-col items-start">
        <div className="rounded-2xl bg-card text-card-foreground border border-border px-6 py-4 shadow-sm ring-1 ring-primary/20">
          <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
            {content}
            <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders animated typing indicator dots.
 * @returns Typing indicator JSX element
 */
function TypingIndicator() {
  return (
    <div className="flex justify-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mt-auto mb-2">
        <CopilotAvatar />
      </div>
      <div className="rounded-2xl bg-card border border-border px-6 py-4 shadow-sm">
        <div className="flex gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

/**
 * Renders loading skeleton bubbles.
 * @returns Loading skeleton JSX element
 */
function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-4 sm:px-8 py-8">
      <div className="flex justify-start gap-3">
        <Skeleton className="h-9 w-9 rounded-full bg-muted" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-80 rounded-lg bg-muted" />
          <Skeleton className="h-4 w-64 rounded-lg bg-muted" />
          <Skeleton className="h-4 w-48 rounded-lg bg-muted" />
        </div>
      </div>
      <div className="flex justify-start gap-3">
        <Skeleton className="h-9 w-9 rounded-full bg-muted" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-72 rounded-lg bg-muted" />
          <Skeleton className="h-4 w-56 rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}

/**
 * Main chat messages container component rendering history, streaming data, and indicators.
 * @param props - Component props
 * @returns Chat messages container JSX element
 */
export function ChatMessages({
  messages,
  isLoading,
  streamingContent,
  isInitializing,
  actorName,
  activeSection, // <-- Recebe aqui
  isReprocessing = false,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastMessage = messages[messages.length - 1];
  const isWaitingForAI = lastMessage?.role === "user";

  const initials = getInitials(actorName);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, isLoading, isReprocessing]);

  if (isInitializing) {
    return (
      <div className="flex-1 overflow-y-auto">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-6 px-4 sm:px-8 py-8">
        {messages.map((msg, index) => {
          const isFirstAssistantMessage =
            index === 0 && msg.role === "assistant";

          return (
            <MessageBubble
              key={msg.id || index}
              message={msg}
              userInitials={initials}
              isFirstAssistantMessage={isFirstAssistantMessage}
              activeSection={activeSection}
            />
          );
        })}

        {isLoading && streamingContent && (
          <StreamingBubble content={streamingContent} />
        )}

        {isLoading && !streamingContent && isWaitingForAI && (
          <div className="flex flex-col gap-4">
            <AiThinkingBlock isReprocessing={isReprocessing} />
            <TypingIndicator />
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}