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
}

export interface CoachApiRequest {
  content: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface CoachCitation {
  citationNumber: number;
  sourceBook: string;
  excerptText: string;
}

export interface CoachApiResponse {
  aiData: {
    coach_reply: string;
    citations: CoachCitation[];
  };
}
