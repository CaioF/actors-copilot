export type CoachType = "general" | "character";

export type FlightPlanStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface AuditionPlanData {
  before_scene: string;
  relationship: string;
  want: string;
  stakes: string;
  obstacle: string;
  primary_action: string;
  shift: string;
  private_thought: string;
  contradiction: string;
  first_five_seconds: string;
  grounding: string;
  final_instruction: string;
  sign_off: string;
}

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
  coachType?: CoachType;
  actorName?: string;
  actorBaseline?: string;
  actorProfile?: string;
  excerpts: RetrievedExcerpt[];
  question: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  auditions?: AuditionSummary[];
  auditionFullData?: Record<string, unknown> & {
    criticalBriefFacts?: import("@/lib/audition-types").CriticalBriefFact[] | null;
    sidesText?: string | null;
  };
  currentFocus?: {
    sessionFocus: string | null;
    stepIndex: number;
    mode: "guided" | "informational" | "transition" | null;
    phase: string | null;
    currentStage?: FlightPlanStage | null;
    completedStages?: number[];
    flightPlanMode?: "guided" | "menu";
  } | null;
}

export interface CoachApiRequest {
  coachType?: CoachType;
  content: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  auditionId?: string;
  currentFocus?: CoachPromptInput["currentFocus"]; 
  document?: import("@/components/chat-input").AttachedDocument | null;
  targetStage?: FlightPlanStage;
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
    current_stage?: FlightPlanStage | null;
    completed_stages?: number[];
    flight_plan_mode?: "guided" | "menu";
    audition_plan?: AuditionPlanData | null;
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
  current_stage?: FlightPlanStage | null;
  completed_stages?: number[];
  flight_plan_mode?: "guided" | "menu";
  audition_plan?: AuditionPlanData | null;
  action: CoachAction | null;
}

