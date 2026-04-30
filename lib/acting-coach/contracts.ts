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
  currentFocus?: CoachPromptInput["currentFocus"]; 
  document?: import("@/components/chat-input").AttachedDocument | null;
}

export interface CoachCitation {
  citationNumber: number;
  sourceBook: string;
  excerptText: string;
}

export type CoachProfileUpdatePayload = Partial<
  Pick<
    import("@/lib/profile-types").ActorProfile,
    | "headshot"
    | "additionalPhotos"
    | "playingAgeMin"
    | "playingAgeMax"
    | "location"
    | "gender"
    | "height"
    | "heightUnit"
    | "eyeColour"
    | "hairColour"
    | "nationalities"
    | "ethnicity"
    | "appearance"
    | "awardsCallout"
    | "bio"
    | "showreels"
    | "credits"
    | "training"
    | "skillsAndAccents"
  >
>;

export type CoachAction =
  | { type: "trigger_dna_extraction"; payload: Record<string, never> }
  | { type: "update_actor_profile"; payload: CoachProfileUpdatePayload };

export interface CoachApiResponse {
  aiData: {
    coach_reply: string;
    session_focus: string | null;
    step_index: number;
    mode: "guided" | "informational" | "transition" | null;
    phase: string | null;
    action?: CoachAction | null;
    extractions?: import("@/lib/chat-types").ExtractedPsychData | null;
  };
}

export interface CoachReplyEnvelope {
  reply: string;
  session_focus: string | null;
  step_index: number;
  mode: "guided" | "informational" | "transition";
  phase: string | null;
  action: CoachAction | null;
}
