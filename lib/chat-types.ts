import type { Timestamp } from "firebase/firestore";

/**
 * Types for DNA extraction chat sessions, including messages, session state,
 * section definitions, and thematic questions.
 * @module
 * @exports ChatMessage, DNASession, DNA_SECTIONS, DNASectionId, DNAQuestion
 */

/**
 * Represents a single message within a DNA extraction chat session.
 * @interface ChatMessage
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Timestamp | null;
  section: string;
}

/**
 * Represents the state and metadata of a user's DNA extraction session.
 * Tracks global progress, section completion, and analytics.
 * @interface DNASession
 */
export interface DNASession {
  // TODO: Consider separating volatile session state (like progress and lastActiveAt) from immutable data (like createdAt) if Firestore write costs become a concern at scale.
  id: string;
  sessionNumber: number;
  totalSessions: number;
  currentSection: string;
  progress: number;
  lastActiveAt: Timestamp | null;
  durationMinutes: number;
  createdAt: Timestamp | null;
  status: "active" | "paused" | "completed";
  totalExtractions?: number;       
  sectionHqCounts?: Record<string, number>; // Maps section IDs to the number of high-quality extractions (e.g., { "identity": 2 })
  completedSections?: string[];
  auditionsUnlocked?: boolean;
  askedQuestions?: string[]; // Array of question strings already presented to the user to prevent repetition
}

/**
 * Defines the core exploration arenas (sections) for the DNA extraction process.
 * NOTE: The 'id' fields must perfectly align with the keys used in the QUESTIONS reservoir.
 * @constant
 */
export const DNA_SECTIONS = [
  { id: "identity", label: "Identity and Self-Story" },
  { id: "childhood", label: "Early Childhood and Home" },
  { id: "school_authority", label: "School, Authority and the Outside World" },
  { id: "belonging", label: "Belonging and Exclusion" },
  { id: "relationships", label: "Relationships and Attachment" },
  { id: "power", label: "Power and Authority" },
  { id: "shame", label: "Shame and Self-Worth" },
  { id: "loss", label: "Loss and Change" },
  { id: "desire", label: "Desire and Ambition" },
  { id: "joy", label: "Joy and Vitality" },
  { id: "conflict", label: "Conflict and Pressure" },
  { id: "beliefs", label: " Beliefs and Life Patterns" },
] as const;

/**
 * Type definition extracting the valid string literal IDs from the DNA_SECTIONS constant.
 * @typedef {string} DNASectionId
 */
export type DNASectionId = (typeof DNA_SECTIONS)[number]["id"];

/**
 * Represents a structured thematic question stored in the system's reservoir.
 * Used to dynamically guide the AI based on the current context.
 * @interface DNAQuestion
 */
export interface DNAQuestion {
  qid: string;
  section: DNASectionId; 
  intensity: number;
  tags: string[];
  question: string;
}

