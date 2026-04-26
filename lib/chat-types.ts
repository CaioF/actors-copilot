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
  askedQuestions?: string[];
  sectionThemes?: Partial<Record<DNASectionId, string[]>>;
  sectionProgress?: Record<DNASectionId, SectionProgress>;
}

export interface CoachSession {
  id: string;
  createdAt: Timestamp | null;
  lastActiveAt: Timestamp | null;
  status: "active" | "completed";
  title: string | null;
  linkedAuditionId: string | null;
  messageCount: number;
  sessionFocus: string | null;
  stepIndex: number;
  mode: "guided" | "informational" | "transition" | null;
  phase: string | null;
}

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Timestamp | null;
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
 * Controlled vocabulary of psychological themes per arena.
 * Used for extraction diversity tracking — ensures varied psychological exploration.
 * @constant
 */
export const ARENA_THEMES: Record<DNASectionId, readonly string[]> = {
  identity: [
    "self_narrative",
    "core_traits",
    "values_anchor",
    "public_vs_private",
    "growth_narrative",
  ],
  childhood: [
    "family_dynamics",
    "early_memory",
    "upbringing_style",
    "sibling_position",
    "foundational_event",
    "early_joy",
  ],
  school_authority: [
    "teacher_relationship",
    "academic_self_image",
    "peer_dynamic",
    "achievement_pattern",
    "rebellion_turning_point",
  ],
  belonging: [
    "group_identification",
    "exclusion_memory",
    "assimilation_pattern",
    "belonging_longing",
    "chosen_family",
  ],
  relationships: [
    "attachment_style",
    "boundary_dynamic",
    "intimacy_capacity",
    "conflict_habitude",
    "trust_pattern",
    "relationship_role",
  ],
  power: [
    "power_dynamic",
    "control_pattern",
    "authority_relationship",
    "empowerment_moment",
    "disempowerment_story",
  ],
  shame: [
    "shame_origin",
    "shame_trigger",
    "shame_coping",
    "shame_relationships",
    "shame_body",
    "shame_identity",
  ],
  loss: [
    "grief_event",
    "grief_process",
    "abandonment_fear",
    "change_adaptation",
    "mortality_perspective",
  ],
  desire: [
    "core_desire",
    "aspiration_fuel",
    "denied_desire",
    "desire_fear",
    "ambition_pattern",
  ],
  joy: [
    "joy_source",
    "play_capacity",
    "body_joy",
    "creative_joy",
    "connection_joy",
  ],
  conflict: [
    "conflict_style",
    "pressure_response",
    "fight_flight_freeze",
    "conflict_aftermath",
    "compromise_pattern",
  ],
  beliefs: [
    "life_belief",
    "self_belief",
    "worthiness_belief",
    "control_belief",
    "relationship_belief",
  ],
};

/**
 * User-friendly display names for psychological themes.
 * Maps theme IDs to human-readable labels for UI display.
 * @constant
 */
export const THEME_DISPLAY_NAMES: Record<string, string> = {
  // identity
  self_narrative: "Self Narrative",
  core_traits: "Core Traits",
  values_anchor: "Values & Beliefs",
  public_vs_private: "Public vs Private Self",
  growth_narrative: "Growth Story",
  // childhood
  family_dynamics: "Family Dynamics",
  early_memory: "Early Memory",
  upbringing_style: "Upbringing Style",
  sibling_position: "Sibling Position",
  foundational_event: "Foundational Event",
  early_joy: "Early Joy",
  // school_authority
  teacher_relationship: "Teacher Relationship",
  academic_self_image: "Academic Self-Image",
  peer_dynamic: "Peer Dynamics",
  achievement_pattern: "Achievement Pattern",
  rebellion_turning_point: "Rebellion Turning Point",
  // belonging
  group_identification: "Group Identification",
  exclusion_memory: "Exclusion Memory",
  assimilation_pattern: "Assimilation Pattern",
  belonging_longing: "Belonging Longing",
  chosen_family: "Chosen Family",
  // relationships
  attachment_style: "Attachment Style",
  boundary_dynamic: "Boundary Setting",
  intimacy_capacity: "Intimacy Capacity",
  conflict_habitude: "Conflict Habits",
  trust_pattern: "Trust Pattern",
  relationship_role: "Relationship Role",
  // power
  power_dynamic: "Power Dynamics",
  control_pattern: "Control Pattern",
  authority_relationship: "Authority Relationship",
  empowerment_moment: "Empowerment Moment",
  disempowerment_story: "Disempowerment Story",
  // shame
  shame_origin: "Shame Origin",
  shame_trigger: "Shame Trigger",
  shame_coping: "Shame Coping",
  shame_relationships: "Shame in Relationships",
  shame_body: "Shame in Body",
  shame_identity: "Shame & Identity",
  // loss
  grief_event: "Grief Event",
  grief_process: "Grief Process",
  abandonment_fear: "Abandonment Fear",
  change_adaptation: "Change Adaptation",
  mortality_perspective: "Mortality Perspective",
  // desire
  core_desire: "Core Desire",
  aspiration_fuel: "Aspiration Fuel",
  denied_desire: "Denied Desire",
  desire_fear: "Desire & Fear",
  ambition_pattern: "Ambition Pattern",
  // joy
  joy_source: "Joy Source",
  play_capacity: "Play Capacity",
  body_joy: "Body Joy",
  creative_joy: "Creative Joy",
  connection_joy: "Connection Joy",
  // conflict
  conflict_style: "Conflict Style",
  pressure_response: "Pressure Response",
  fight_flight_freeze: "Fight/Flight/Freeze",
  conflict_aftermath: "Conflict Aftermath",
  compromise_pattern: "Compromise Pattern",
  // beliefs
  life_belief: "Life Philosophy",
  self_belief: "Self-Belief",
  worthiness_belief: "Worthiness Belief",
  control_belief: "Control Belief",
  relationship_belief: "Relationship Belief",
  // special
  novel_theme: "Novel Theme",
};

/**
 * Tracks progress within a single DNA arena/section.
 * @interface SectionProgress
 */
export interface SectionProgress {
  hqCount: number;
  themesCovered: string[];
  themeCounts: Record<string, number>;
  isComplete: boolean;
}

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

