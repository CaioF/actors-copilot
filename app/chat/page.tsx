"use client";

import { getAuth } from "firebase/auth";
import { getApp } from "@/lib/firebase";
import { useEffect, useState } from "react";
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
    changeSection,
    isLoading,
    streamingContent,
    isInitializing,
  } = useChat();

  const [activeSection, setActiveSection] = useState("identity"); // Default to the first section
  const [isSynthesizing, setIsSynthesizing] = useState(false); // State for our test button

  //filter section messages
  const filteredMessages = messages.filter(
    (msg) => msg.section === activeSection
  );

  // Se a sessão for carregada do Firebase e tiver uma seção salva, a UI muda pra ela
  useEffect(() => {
    if (session?.currentSection && session.currentSection !== activeSection) {
      setActiveSection(session.currentSection);
    }
  }, [session?.currentSection]); // Roda sempre que o Firebase avisar de mudança

  /**
   * TEST HANDLER: Securely calls the backend DNA Synthesizer route.
   * Grabs the current user's Firebase token to authorize the request.
   */
  const handleTestSynthesis = async () => {
    try {
      setIsSynthesizing(true);
      
      const auth = getAuth(getApp());
      const user = auth.currentUser;
      
      if (!user) {
        console.error("Authentication Error: No user logged in.");
        alert("Please log in to test the synthesis.");
        return;
      }

      // Securely fetch the session token
      const token = await user.getIdToken();

      console.log("Triggering Synthesis AI...");
      const response = await fetch('/api/dna/synthesize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log("✅ SYNTHESIS COMPLETE. Result:", data);
        alert("Synthesis complete! Open your browser console to see the JSON profile.");
      } else {
        console.error("❌ SYNTHESIS FAILED:", data);
        alert(`Synthesis failed: ${data.error}`);
      }

    } catch (error) {
      console.error("Network or execution error during synthesis:", error);
      alert("A critical error occurred. Check the console.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F0E8DC]">
      {/* Chat-specific sidebar with session info, DNA sections, progress */}
      <ChatSidebar
        session={session}
        activeSection={activeSection}
        onSectionClick={(sectionClicked) => {
          setActiveSection(sectionClicked);
          if (changeSection) {
            changeSection(sectionClicked);
          }
        } }
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader title="AI Copilot DNA Extraction" />

        {/* Chat message area */}
        <ChatMessages
          messages={filteredMessages}
          isLoading={isLoading}
          streamingContent={streamingContent}
          isInitializing={isInitializing}
        />

        {/* =========================================
            TEST BUTTON: DNA SYNTHESIZER
            Placed directly above the input as requested
            ========================================= */}
        <div className="flex justify-center w-full py-2 bg-[#F0E8DC]">
          <button
            onClick={handleTestSynthesis}
            disabled={isSynthesizing || isInitializing}
            className="w-fit bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-2 px-6 rounded-full shadow-md transition-all ease-in-out duration-200 text-sm"
          >
            {isSynthesizing ? "Synthesizing Data (Check Console)..." : "🧪 Test AI Synthesis"}
          </button>
        </div>
        {/* Input bar */}
        <ChatInput onSend={(content) => sendMessage(content, activeSection)} isLoading={isLoading} />

        {/* Footer */}
        <DashboardFooter />
      </div>
    </div>
  );
}
