"use client";

import { useState } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardFooter } from "@/components/dashboard-footer";
import { ChatMessages } from "@/components/chat-messages";
import { ChatInput } from "@/components/chat-input";
import { useChat } from "@/hooks/use-chat";

export default function ChatPage() {
  const {
    messages,
    session,
    sendMessage,
    isLoading,
    streamingContent,
    isInitializing,
  } = useChat();

  const [activeSection, setActiveSection] = useState("introduction");

  return (
    <div className="flex h-screen bg-[#F0E8DC]">
      {/* Chat-specific sidebar with session info, DNA sections, progress */}
      <ChatSidebar
        session={session}
        activeSection={activeSection}
        onSectionClick={setActiveSection}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader title="AI Copilot DNA Extraction" />

        {/* Chat message area */}
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          streamingContent={streamingContent}
          isInitializing={isInitializing}
        />

        {/* Input bar */}
        <ChatInput onSend={(content) => sendMessage(content, activeSection)} isLoading={isLoading} />

        {/* Footer */}
        <DashboardFooter />
      </div>
    </div>
  );
}
