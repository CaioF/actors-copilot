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
  actorName?: string;
  actorBaseline?: string;
  excerpts: RetrievedExcerpt[];
  question: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  auditions?: AuditionSummary[];
  auditionFullData?: Record<string, unknown>;
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
  };
}
