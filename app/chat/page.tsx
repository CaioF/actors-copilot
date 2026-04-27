"use client";

import { useEffect, useState } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { DashboardFooter } from "@/components/dashboard-footer";
import { ChatMessages } from "@/components/chat-messages";
import { ChatInput } from "@/components/chat-input";
import { useChat } from "@/hooks/use-chat";
import { getAuth } from "firebase/auth";

/**
 * Main Chat Page component for the AI Copilot DNA Extraction feature.
 * Orchestrates the layout, integrating the sidebar, chat history, and input mechanism.
 * Manages the local UI state for the currently active chat section and synchronizes
 * it with the remote session state.
 * @returns The rendered chat page layout
 */
export default function ChatPage() {
  const {
    messages,
    session,
    sendMessage,
    changeSection,
    isLoading,
    isReprocessing,
    streamingContent,
    isInitializing,
  } = useChat();

  const [activeSection, setActiveSection] = useState("identity"); // Default to the first section
  const [isSynthesizing, setIsSynthesizing] = useState(false); // State for our test button

  const [actorName, setActorName] = useState("ME");

  // search name on firestore
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.displayName) {
        setActorName(user.displayName);
      }
    });
    return () => unsubscribe();
  }, []);

  /**
   * Filters the global message history to only display messages relevant to the currently selected section.
   * @returns Array of messages that belong to the active section
   */
  const filteredMessages = messages.filter(
    (msg) => msg.section === activeSection
  );

  const lastUserMessage = [...filteredMessages].reverse().find(msg => msg.role === 'user');
  const isSessionPaused = lastUserMessage?.content?.includes("ground myself and close the session.");

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
        <DashboardHeader title="Personal DNA Extraction" />

        {/* Chat message display area */}
        <ChatMessages
          messages={filteredMessages}
          isLoading={isLoading}
          actorName={actorName}
          streamingContent={streamingContent}
          isInitializing={isInitializing}
        />

        

        {/* =========================================
            QUICK ACTIONS / SHORTCUTS
            Help the actor navigate the conversation easily
            ========================================= */}
        <div className="flex justify-center items-center gap-3 w-full py-3 bg-[#F0E8DC]">
         
          
          {/* /**
             * Triggers the safe termination protocol for the current session.
             * Dispatches a system-level command to the AI backend to halt 
             * Socratic extraction and initiate a psychological grounding text.
             */  }
          {isSessionPaused ? (
            <>
            <button
              onClick={() => sendMessage("Pick up where I left off", activeSection)}
              disabled={isLoading || isInitializing}
              className="text-xs font-semibold text-[#6B6B6B] border border-[#C7C0B5] bg-transparent hover:bg-[#d0e8df] hover:text-[#2C3328] px-5 py-2 rounded-full transition-colors disabled:opacity-50"
            >
              Pick up where I left off
            </button>

            <button
              onClick={() => sendMessage("Start something new", activeSection)}
              disabled={isLoading || isInitializing}
              className="text-xs font-semibold text-[#6B6B6B] border border-[#C7C0B5] bg-transparent hover:bg-[#d0e8df] hover:text-[#2C3328] px-5 py-2 rounded-full transition-colors disabled:opacity-50"
            >
              Start something new
            </button>
            </>
          ) : (
            <>
            <button
            onClick={() => sendMessage("Change the subject, next question", activeSection)}
            disabled={isLoading || isInitializing}
            className="text-xs font-semibold text-[#6B6B6B] border border-[#C7C0B5] bg-transparent hover:bg-[#E8DFD0] hover:text-[#2C3328] px-5 py-2 rounded-full transition-colors disabled:opacity-50"
          >
            Change the subject
          </button>
          <button
            onClick={() => sendMessage("I don't understand the question", activeSection)}
            disabled={isLoading || isInitializing}
            className="text-xs font-semibold text-[#6B6B6B] border border-[#C7C0B5] bg-transparent hover:bg-[#E8DFD0] hover:text-[#2C3328] px-5 py-2 rounded-full transition-colors disabled:opacity-50"
          >
            I don't understand the question
          </button>
            <button
              onClick={() => sendMessage("I need to stop now. Please help me ground myself and close the session.", activeSection)}
              disabled={isLoading || isInitializing}
              className="text-xs font-semibold text-[#6B6B6B] border border-[#C7C0B5] bg-transparent hover:bg-[#ffa2a2] hover:text-[#2C3328] px-5 py-2 rounded-full transition-colors disabled:opacity-50"
            >
              END SESSION
            </button>
            </>
          )}
        </div>

        {/* Input bar */}
        <ChatInput 
          onSend={(content, document) => sendMessage(content, activeSection, document)} 
          isLoading={isLoading} 
        />

        {/* Footer */}
        <DashboardFooter />
      </div>
    </div>
  );
}