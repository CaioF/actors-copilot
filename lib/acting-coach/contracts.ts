export interface AuditionSummary {
  id: string;
  project: string;
  role: string;
  createdAt: string;
}

export interface RetrievedExcerpt {
  citationNumber: number;
  sourceBook: string;
  excerptText: string;
  score: number;
}

export interface CoachPromptInput {
  actorBaseline?: string;
  excerpts: RetrievedExcerpt[];
  question: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  auditions?: AuditionSummary[];
  auditionFullData?: Record<string, unknown>;
  currentFocus?: {
    sessionFocus: string | null;
    stepIndex: number;
    mode: "guided" | "informational" | "transition" | null;
    phase: string | null;
  } | null;
}

export interface CoachApiRequest {
  content: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  auditionId?: string;
}

export interface CoachCitation {
  citationNumber: number;
  sourceBook: string;
  excerptText: string;
}

export interface CoachApiResponse {
  aiData: {
    coach_reply: string;
    session_focus: string | null;
    step_index: number;
    mode: "guided" | "informational" | "transition" | null;
    phase: string | null;
    action?: { type: string; payload?: Record<string, unknown> } | null;
    extractions?: import("@/lib/chat-types").ExtractedPsychData | null;
  };
}

export interface CoachReplyEnvelope {
  reply: string;
  session_focus: string | null;
  step_index: number;
  mode: "guided" | "informational" | "transition";
  phase: string | null;
  action: { type: string; payload?: Record<string, unknown> } | null;
}
