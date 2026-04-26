"use client";

import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatMessage } from "@/lib/chat-types";
import { AiThinkingBlock } from "./ai-thinking-block";
import { FileText } from "lucide-react";
import { renderMarkdown } from "@/lib/render-markdown";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  streamingContent: string;
  isInitializing: boolean;
  isReprocessing?: boolean;
  actorName?: string;
}

export function getInitials(name?: string) {
  if (!name) return "ME";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Formats a timestamp into a human-readable time string.
 * @param timestamp - The timestamp to format (supports Firebase Timestamp format)
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
 * Renders the Copilot avatar icon displaying "The Actors Copilot" branding.
 * @returns The Copilot avatar JSX element
 */
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

/**
 * Renders a chat message bubble with appropriate styling based on role (user/assistant).
 * @param props - The component props
 * @param props.message - The chat message to display
 * @param props.userInitials - The user's initials for their avatar
 * @returns The message bubble JSX element
 */
function MessageBubble({ message, userInitials }: { message: ChatMessage & { attachmentName?: string }, userInitials: string }) {
  const isAssistant = message.role === "assistant";

  return (
    <div
      className={`flex gap-1 ${isAssistant ? "justify-start" : "justify-end"}`}
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
          {/* =======================================================
              DOCUMENT ATTACHMENT BADGE
              Renders a visual indicator inside the user's message bubble 
              if a file was attached during submission.
              ======================================================= */}
          {!isAssistant && message.attachmentName && (
            <div className="flex items-center gap-1.5 rounded-md bg-[#2C3328]/40 px-2.5 py-1.5 mb-3 w-fit border border-[#F5F0E8]/10">
              <FileText size={12} className="text-[#F5F0E8]/70" />
              <span className="text-[11px] font-medium text-[#F5F0E8]/90 truncate max-w-[180px]">
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
        <span className="mt-1.5 text-xs text-[#6B6B6B]">
          {formatTime(message.timestamp)}
        </span>
      </div>

      {!isAssistant && (
        <div className="mt-auto mb-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-[#4A5548] text-xs text-[#F5F0E8]">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
}

/**
 * Renders a streaming message bubble with animated cursor indicating content is being generated.
 * @param props - The component props
 * @param props.content - The current streaming content to display
 * @returns The streaming bubble JSX element
 */
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

/**
 * Renders an animated typing indicator showing three bouncing dots.
 * @returns The typing indicator JSX element
 */
// O TypingIndicator voltou!
function TypingIndicator() {
  return (
    <div className="flex justify-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
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

/**
 * Renders a loading skeleton with placeholder message bubbles.
 * @returns The loading skeleton JSX element
 */
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

/**
 * Main chat messages container component that renders all messages, streaming content, and indicators.
 * @param props - The component props
 * @param props.messages - Array of chat messages to display
 * @param props.isLoading - Whether the AI is currently loading/generating a response
 * @param props.streamingContent - Current streaming content being generated
 * @param props.isInitializing - Whether the component is in initial loading state
 * @param props.actorName - Optional name of the actor for user initials
 * @param props.isReprocessing - Whether the AI is reprocessing (shows different thinking indicator)
 * @returns The chat messages container JSX element
 */
export function ChatMessages({
  messages,
  isLoading,
  streamingContent,
  isInitializing,
  actorName,
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
      <div className="flex flex-col gap-6 px-12 py-8">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} userInitials={initials} />
        ))}
        
        {isLoading && streamingContent && (
          <StreamingBubble content={streamingContent} />
        )}
        
        {isLoading && !streamingContent && isWaitingForAI &&(
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