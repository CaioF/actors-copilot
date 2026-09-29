import { DNASectionId } from "@/lib/chat-types";

export interface ResponseShortcut {
  label: string;
  text: string;
}

/**
 * Pre-built contextual response shortcuts per DNA section.
 * Provides actors with personalized answer starters to reduce typing friction
 * while keeping the main text input as the primary response tool.
 */
export const SECTION_RESPONSE_SHORTCUTS: Record<string, ResponseShortcut[]> = {
  identity: [
    {
      label: "💬 Outspoken vs Private",
      text: "I'm usually seen as outgoing and confident, but underneath I keep my deeper doubts private."
    },
    {
      label: "💬 Quiet Observer",
      text: "I'm a quiet observer who prefers to analyze people before fully opening up."
    },
    {
      label: "💬 Adaptable Harmonizer",
      text: "I tend to adapt my personality to different groups to keep the peace and avoid conflict."
    }
  ],
  childhood: [
    {
      label: "💬 High Expectations",
      text: "I grew up in an environment with high expectations where failure wasn't an option."
    },
    {
      label: "💬 Independent Early",
      text: "My upbringing required me to become self-reliant and independent very early on."
    },
    {
      label: "💬 Creative Freedom",
      text: "I was given a lot of creative freedom to explore and express my emotions as a child."
    }
  ],
  school_authority: [
    {
      label: "💬 Followed Rules",
      text: "I generally followed the rules to keep a low profile and avoid unnecessary conflict."
    },
    {
      label: "💬 Challenged Fairness",
      text: "I tended to question authority figures whenever I felt a rule was unfair."
    },
    {
      label: "💬 Earned Respect",
      text: "I only respected authority figures who proved they actually cared about people."
    }
  ],
  belonging: [
    {
      label: "💬 Inner Circle",
      text: "I've always preferred a tight-knit inner circle over fitting into large crowds."
    },
    {
      label: "💬 The Chameleon",
      text: "I used to blend into different social groups easily without fully belonging to one."
    },
    {
      label: "💬 Observer Perspective",
      text: "I often felt like an observer looking in, which helped me understand human behavior."
    }
  ],
  relationships: [
    {
      label: "💬 Deep Commitment",
      text: "I invest deeply in relationships and value loyalty above everything else."
    },
    {
      label: "💬 Protective Guard",
      text: "I keep a protective guard up until someone earns my complete trust."
    },
    {
      label: "💬 Conflict Averse",
      text: "I prioritize emotional harmony and prefer to resolve misunderstandings calmly."
    }
  ],
  power: [
    {
      label: "💬 Preparation Control",
      text: "I feel most in control when I am thoroughly prepared and organized."
    },
    {
      label: "💬 Resists Control",
      text: "I strongly push back against being micromanaged or told how to feel."
    },
    {
      label: "💬 Steps Up to Lead",
      text: "I naturally step up to lead when a situation lacks clear direction."
    }
  ],
  shame: [
    {
      label: "💬 Perfectionist Armor",
      text: "I use high standards and perfectionism to protect myself from criticism."
    },
    {
      label: "💬 Internal Reflection",
      text: "When I feel judged, I tend to retreat inward and analyze what went wrong."
    },
    {
      label: "💬 Humor Shield",
      text: "I use self-deprecating humor to disarm awkwardness or judgment."
    }
  ],
  loss: [
    {
      label: "💬 Private Grieving",
      text: "I process grief and major life changes privately before sharing with others."
    },
    {
      label: "💬 Practical Coping",
      text: "When faced with loss, I focus on practical next steps to keep moving forward."
    },
    {
      label: "💬 Deep Transformation",
      text: "Loss stays with me for a long time and deeply reshapes how I view life."
    }
  ],
  desire: [
    {
      label: "💬 Truthful Legacy",
      text: "My deepest drive is to create honest, impactful work that resonates with people."
    },
    {
      label: "💬 Autonomy & Freedom",
      text: "I desire complete creative and personal freedom above status or security."
    },
    {
      label: "💬 Craft Mastery",
      text: "I'm driven by the quiet satisfaction of mastering my craft day by day."
    }
  ],
  joy: [
    {
      label: "💬 Creative Flow",
      text: "I feel most joyful when I'm in the zone, lost in creative collaboration."
    },
    {
      label: "💬 Unfiltered Connection",
      text: "Real, unfiltered conversations with close friends bring me true joy."
    },
    {
      label: "💬 Playful Spontaneity",
      text: "Unplanned, spontaneous moments where I can laugh freely give me energy."
    }
  ],
  conflict: [
    {
      label: "💬 Direct & Honest",
      text: "I address conflict directly so issues don't fester underneath."
    },
    {
      label: "💬 Cool-Off First",
      text: "I step back to cool off before discussing a tense conflict."
    },
    {
      label: "💬 De-escalator",
      text: "I try to understand the other person's perspective to defuse tension."
    }
  ],
  beliefs: [
    {
      label: "💬 Self-Reliance",
      text: "I believe you ultimately have to create your own opportunities in life."
    },
    {
      label: "💬 Growth Mindset",
      text: "I believe every setback is a necessary lesson for personal growth."
    },
    {
      label: "💬 Empathy First",
      text: "I believe empathy and understanding are the most important human values."
    }
  ]
};

/**
 * Gets the response shortcuts for a given section ID, or defaults to identity.
 */
export function getResponseShortcuts(sectionId: string): ResponseShortcut[] {
  return SECTION_RESPONSE_SHORTCUTS[sectionId] || SECTION_RESPONSE_SHORTCUTS["identity"];
}
