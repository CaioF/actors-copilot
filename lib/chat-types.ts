import type { Timestamp } from "firebase/firestore";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Timestamp | null;
  section: string;
}

export interface DNASession {
  id: string;
  sessionNumber: number;
  totalSessions: number;
  currentSection: string;
  progress: number;
  lastActiveAt: Timestamp | null;
  durationMinutes: number;
  createdAt: Timestamp | null;
  status: "active" | "paused" | "completed";
}

export const DNA_SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "life_story", label: "Life Story" },
  { id: "personal_life", label: "Personal Life" },
  { id: "miscellaneous", label: "Miscellaneous" },
] as const;

export type DNASectionId = (typeof DNA_SECTIONS)[number]["id"];

export const SYSTEM_PROMPT = `You are The Actors Copilot — a direct, craft-focused AI that helps actors build their Personal DNA Vault.

You are currently guiding the actor through DNA Extraction. You work through sections: Introduction, Life Story, Personal Life, Miscellaneous.

Rules:
- Be direct. This is craft, not therapy.
- Ask one focused question at a time.
- Push for sensory specifics: what did it smell like, what were you wearing, what was the light like.
- When the actor gives vague answers, push deeper.
- Acknowledge what they share briefly, then move forward.
- Track patterns: needs, contradictions, protective strategies.
- Never be sycophantic. Be respectful but demanding.
- Keep responses concise — 2-4 paragraphs max.`;

export const INTRO_MESSAGE = `This process exists for one reason only: to make you a more truthful, dangerous, and compelling actor.

Every great actor draws from a private, specific, lived archive. Not ideas. Not concepts. Events. Moments where something was at stake. Moments that left a mark.

This engine helps you build that archive.

It will:
- Extract real turning points from your life.
- Anchor them in sensory truth so they are playable, not theoretical.
- Map your patterns: needs, contradictions, protective strategies.
- Turn your lived experience into usable fuel for character breakdowns, subtext, objectives, and stakes.

This is not journaling. It is not therapy. It is craft. You are expected to take this seriously.

- The deeper you go, the more there is to draw from later.
- The more specific you are, the more reliable your acting choices become.

You will work in sessions. You can pause and resume. But you cannot skip the foundations.`;
