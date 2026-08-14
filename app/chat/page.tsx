"use client";

import { useEffect, useState } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardFooter } from "@/components/dashboard-footer";
import { ChatMessages } from "@/components/chat-messages";
import { ChatInput } from "@/components/chat-input";
import { useChat } from "@/hooks/use-chat";
import { getAuth } from "firebase/auth";
import { Sparkles, HelpCircle, Flag, Play, RefreshCw } from "lucide-react";

/**
 * Main Chat Page component for the AI Copilot DNA Extraction feature.
 * Orchestrates layout with left-aligned hero card and centered action shortcuts above input.
 * @returns {JSX.Element} The rendered chat page layout
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

  const [activeSection, setActiveSection] = useState("identity");
  const [actorName, setActorName] = useState("ME");

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.displayName) {
        setActorName(user.displayName);
      }
    });
    return () => unsubscribe();
  }, []);

  const filteredMessages = messages.filter(
    (msg) => msg.section === activeSection
  );

  const lastUserMessage = [...filteredMessages]
    .reverse()
    .find((msg) => msg.role === "user");
  const isSessionPaused = lastUserMessage?.content?.includes(
    "ground myself and close the session."
  );

  useEffect(() => {
    if (session?.currentSection && session.currentSection !== activeSection) {
      setActiveSection(session.currentSection);
    }
  }, [session?.currentSection]);

  return (
    <div className="flex h-screen bg-background text-foreground transition-colors">
      {/* Sidebar with section and progress tracking */}
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

      {/* Main chat viewport */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader title="Personal DNA Extraction" />

        {/* Scrollable messages container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-8">
          <ChatMessages
            messages={filteredMessages}
            isLoading={isLoading}
            actorName={actorName}
            streamingContent={streamingContent}
            isInitializing={isInitializing}
          />
        </div>

        {/* =========================================
            QUICK ACTIONS / SHORTCUTS (Centered Above Input)
            ========================================= */}
        <div className="w-full px-4 py-3 bg-background flex justify-center items-center">
          {isSessionPaused ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => sendMessage("Pick up where I left off", activeSection)}
                disabled={isLoading || isInitializing}
                className="flex items-center gap-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 rounded-full shadow-sm transition-all disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                Pick up where I left off
              </button>

              <button
                onClick={() => sendMessage("Start something new", activeSection)}
                disabled={isLoading || isInitializing}
                className="flex items-center gap-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 rounded-full shadow-sm transition-all disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Start something new
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() =>
                  sendMessage("Change the subject, next question", activeSection)
                }
                disabled={isLoading || isInitializing}
                className="flex items-center gap-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2.5 rounded-full shadow-sm transition-all disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Change the subject
              </button>

              <button
                onClick={() =>
                  sendMessage("I don't understand the question", activeSection)
                }
                disabled={isLoading || isInitializing}
                className="flex items-center gap-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2.5 rounded-full shadow-sm transition-all disabled:opacity-50"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                I don't understand the question
              </button>

              <button
                onClick={() =>
                  sendMessage(
                    "I need to stop now. Please help me ground myself and close the session.",
                    activeSection
                  )
                }
                disabled={isLoading || isInitializing}
                className="flex items-center gap-2 text-xs font-semibold border border-border bg-card text-foreground hover:bg-muted px-4 py-2.5 rounded-2xl shadow-sm transition-all disabled:opacity-50"
              >
                <Flag className="h-3.5 w-3.5 text-foreground" />
                End Session
              </button>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <ChatInput
          onSend={(content, document) =>
            sendMessage(content, activeSection, document)
          }
          isLoading={isLoading}
        />

        {/* Footer */}
        <DashboardFooter />
      </div>
    </div>
  );
}