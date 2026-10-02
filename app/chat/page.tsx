"use client";

import { useEffect, useState } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardFooter } from "@/components/dashboard-footer";
import { ChatMessages } from "@/components/chat-messages";
import { ChatInput } from "@/components/chat-input";
import { useChat } from "@/hooks/use-chat";
import { useSessionTimer } from "@/hooks/use-session-timer";
import { useChatTimeTracker } from "@/hooks/use-chat-time-tracker";
import { BreakCheckInModal } from "@/components/break-check-in-modal";
import { ChatHelpModal } from "@/components/chat-help-modal";
import { HistoryUploadModal } from "@/components/history-upload-modal";
import { DNA_CHAPTERS, DNASectionId } from "@/lib/chat-types";
import { getAuth } from "firebase/auth";
import { Sparkles, HelpCircle, Flag, Play, RefreshCw, Upload } from "lucide-react";

/**
 * Main Chat Page component for the AI Copilot DNA Extraction feature.
 * Orchestrates layout with left-aligned hero card and centered action shortcuts above input.
 * @returns {JSX.Element} The rendered chat page layout
 */
export default function ChatPage() {
  useChatTimeTracker();

  const {
    messages,
    session,
    sendMessage,
    changeSection,
    isLoading,
    streamingContent,
    isInitializing,
  } = useChat();

  const {
    isBreakPromptOpen,
    dismissBreakPrompt,
  } = useSessionTimer();

  const [activeSection, setActiveSection] = useState("chapter_1");
  const [actorName, setActorName] = useState("ME");
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.displayName) {
        setActorName(user.displayName);
      }
    });
    return () => unsubscribe();
  }, []);

  const currentChapter =
    DNA_CHAPTERS.find(
      (ch) =>
        ch.id === activeSection ||
        ch.sections.includes(activeSection as DNASectionId)
    ) || DNA_CHAPTERS[0];

  const filteredMessages = messages.filter((msg) => {
    if (msg.section === activeSection) return true;
    if (currentChapter && (currentChapter.id === activeSection || activeSection.startsWith("chapter_"))) {
      return currentChapter.sections.includes(msg.section as DNASectionId);
    }
    return false;
  });

  const lastUserMessage = [...filteredMessages]
    .reverse()
    .find((msg) => msg.role === "user");
  const isSessionPaused = lastUserMessage?.content?.includes(
    "ground myself and close the session."
  );

  useEffect(() => {
    if (session?.currentSection) {
      const chapterId = session.currentSection.startsWith("chapter_")
        ? session.currentSection
        : DNA_CHAPTERS.find((ch) =>
            ch.sections.includes(session.currentSection as DNASectionId)
          )?.id || "chapter_1";
      if (chapterId !== activeSection) {
        setActiveSection(chapterId);
      }
    }
  }, [session?.currentSection, activeSection]);

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
        <DashboardHeader
          title="Personal DNA Extraction"
          extraActions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsHelpModalOpen(true)}
                className="flex h-9 items-center gap-1.5 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
                aria-label="How DNA Extraction Works"
                title="How DNA Extraction Works"
              >
                <HelpCircle className="h-4 w-4 text-primary" />
                <span className="hidden sm:inline">How it works</span>
              </button>

              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex h-9 items-center gap-1.5 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Upload Baseline</span>
              </button>
            </div>
          }
        />

        {/* Scrollable messages container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <ChatMessages
            messages={filteredMessages}
            isLoading={isLoading}
            activeSection={activeSection}
            actorName={actorName}
            streamingContent={streamingContent}
            isInitializing={isInitializing}
          />
        </div>

        {/* =========================================
            QUICK ACTIONS / SHORTCUTS (Centered Above Input)
            ========================================= */}
        <div className="w-full px-4 sm:px-8 py-1.5 bg-background flex justify-center items-center">
          {isSessionPaused ? (
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-5xl">
              <button
                onClick={() => sendMessage("Pick up where I left off", activeSection)}
                disabled={isLoading || isInitializing}
                className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 px-3.5 py-1.5 rounded-full shadow-2xs transition-all disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5" />
                Pick up where I left off
              </button>

              <button
                onClick={() => sendMessage("Start something new", activeSection)}
                disabled={isLoading || isInitializing}
                className="flex items-center gap-1.5 text-xs font-medium bg-muted/80 text-foreground hover:bg-muted border border-border/50 px-3.5 py-1.5 rounded-full shadow-2xs transition-all disabled:opacity-40"
              >
                <RefreshCw className="h-3.5 w-3.5 text-primary" />
                Start something new
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-5xl">
              <button
                onClick={() =>
                  sendMessage("Change the subject, next question", activeSection)
                }
                disabled={isLoading || isInitializing}
                className="flex items-center gap-1.5 text-xs font-medium bg-card/70 hover:bg-muted/80 border border-border/50 text-foreground/80 hover:text-foreground px-3.5 py-1.5 rounded-full shadow-2xs transition-all disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Change the subject
              </button>

              <button
                onClick={() =>
                  sendMessage("I don't understand the question", activeSection)
                }
                disabled={isLoading || isInitializing}
                className="flex items-center gap-1.5 text-xs font-medium bg-card/70 hover:bg-muted/80 border border-border/50 text-foreground/80 hover:text-foreground px-3.5 py-1.5 rounded-full shadow-2xs transition-all disabled:opacity-40"
              >
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                Clarify question
              </button>

              <button
                onClick={() =>
                  sendMessage(
                    "I need to stop now. Please help me ground myself and close the session.",
                    activeSection
                  )
                }
                disabled={isLoading || isInitializing}
                className="flex items-center gap-1.5 text-xs font-medium bg-card/70 hover:bg-muted/80 border border-border/50 text-foreground/80 hover:text-foreground px-3.5 py-1.5 rounded-full shadow-2xs transition-all disabled:opacity-40"
              >
                <Flag className="h-3.5 w-3.5 text-muted-foreground" />
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

      {/* Timed Session Break Check-In Modal */}
      <BreakCheckInModal
        isOpen={isBreakPromptOpen}
        onKeepGoing={dismissBreakPrompt}
      />

      {/* How DNA Extraction Works Help Modal */}
      <ChatHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        onOpenUpload={() => setIsUploadModalOpen(true)}
      />

      {/* Fast-Track History/Baseline Upload Modal */}
      {isUploadModalOpen && (
        <HistoryUploadModal
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => setIsUploadModalOpen(false)}
        />
      )}
    </div>
  );
}