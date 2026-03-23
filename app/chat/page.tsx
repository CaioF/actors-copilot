"use client";

import { useEffect, useState } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardFooter } from "@/components/dashboard-footer";
import { ChatMessages } from "@/components/chat-messages";
import { ChatInput } from "@/components/chat-input";
import { useChat } from "@/hooks/use-chat";

/**
 * Main Chat Page component for the AI Copilot DNA Extraction feature.
 * Orchestrates the layout, integrating the sidebar, chat history, and input mechanism.
 * Manages the local UI state for the currently active chat section and synchronizes 
 * it with the remote session state.
 *
 * @returns {JSX.Element} The rendered chat page layout.
 */
export default function ChatPage() {
  const {
    messages,
    session,
    sendMessage,
    changeSection,
    isLoading,
    streamingContent,
    isInitializing,
  } = useChat();

  // TODO: Extract the "identity" magic string into a shared constants file or Enum (e.g., SECTIONS.IDENTITY) to prevent typos and ensure consistency across the app.
  const [activeSection, setActiveSection] = useState("identity");

  /**
   * Filters the global message history to only display messages relevant to the currently selected section.
   * * // TODO: Consider wrapping this filtering logic in a useMemo hook if the messages array is expected to grow significantly, to prevent unnecessary recalculations on every render.
   */
  const filteredMessages = messages.filter(
    (msg) => msg.section === activeSection
  );

  /**
   * Synchronizes the local active section state with the remote session data from Firebase.
   * Ensures that if the backend updates the current section (e.g., upon loading a saved session),
   * the UI correctly reflects this change automatically.
   */
  useEffect(() => {
    if (session?.currentSection && session.currentSection !== activeSection) {
      setActiveSection(session.currentSection);
    }
  }, [session?.currentSection]);

  return (
    <div className="flex h-screen bg-[#F0E8DC]">
      
      {/* Chat-specific sidebar with session info, DNA sections, and progress tracking */}
      <ChatSidebar
        session={session}
        activeSection={activeSection}
        onSectionClick={(sectionClicked) => {
          setActiveSection(sectionClicked);
          if (changeSection) {
            changeSection(sectionClicked);
          }
        }}
      />

      {/* Main content area */}
      {/* TODO: Implement an Error Boundary or empty state fallback in case the useChat hook fails to initialize properly. */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader title="AI Copilot DNA Extraction" />

        {/* Chat message display area */}
        <ChatMessages
          messages={filteredMessages}
          isLoading={isLoading}
          streamingContent={streamingContent}
          isInitializing={isInitializing}
        />

        {/* User input bar */}
        <ChatInput 
          onSend={(content) => sendMessage(content, activeSection)} 
          isLoading={isLoading} 
        />

        {/* Footer */}
        <DashboardFooter />
      </div>
    </div>
  );
}