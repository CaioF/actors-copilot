import { useState } from "react";

export const useSearchParams = () => new URLSearchParams();
export function DashboardHeader({ titleSlot, title }) {
  return <header className="border-b bg-card p-5">{titleSlot || title}</header>;
}
export function FixtureImage({ src, alt, width, height, className }) {
  return <img {...{ src, alt, width, height, className }} />;
}
export function useActingCoach() {
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState("general");
  const [isLoading, setLoading] = useState(false);
  const session = {
    id: "demo",
    title: "Night ferry rehearsal",
    coachType: mode,
  };
  return {
    messages,
    isLoading,
    session,
    sessionId: session.id,
    sessions: [session],
    isAuthenticated: true,
    setCoachType: setMode,
    startNewSession({ coachType }) {
      setMode(coachType);
      setMessages([]);
    },
    async sendMessage(text) {
      setMessages([{ id: "question", role: "user", content: text }]);
      setLoading(true);
      try {
        const response = await fetch("/api/coach/chat", {
          method: "POST",
          body: JSON.stringify({ content: text }),
        });
        const { aiData } = await response.json();
        setMessages((previous) => [
          ...previous,
          { id: "answer", role: "assistant", content: aiData.coach_reply },
        ]);
      } finally {
        setLoading(false);
      }
    },
  };
}
