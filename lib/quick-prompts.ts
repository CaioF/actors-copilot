/**
 * Represents a specific category for the Quick Prompts dropdown.
 */
export interface QuickPromptCategory {
  id: "actors_craft" | "actors_career" | "actors_mindset" | "profile_management";
  label: string;
}

/**
 * Represents a pre-written conversation starter template for the Acting Coach.
 */
export interface QuickPrompt {
  id: string;
  text: string;
  category: "actors_craft" | "actors_career" | "actors_mindset" | "profile_management";
  placeholderKeys: string[];
}

/**
 * The available categories for grouping quick prompts in the UI.
 */
export const QUICK_PROMPT_CATEGORIES: QuickPromptCategory[] = [
  { id: "actors_craft", label: "Actor's Craft" },
  { id: "actors_career", label: "Actor's Career" },
  { id: "actors_mindset", label: "Actor's Mindset" },
  { id: "profile_management", label: "Profile Management" },
];

/**
 * The complete library of quick prompts for the Acting Coach.
 * Placeholder keys are strictly mapped to their corresponding [variable] syntax within the text.
 */
export const QUICK_PROMPTS: QuickPrompt[] = [
  // --- The Actor's Craft (21 Prompts) ---
  {
    id: "craft-1",
    text: "I'm working on a scene. Help me define my character's Overall Objective and then walk me through a 'Destination' exercise to make that goal physical.",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-2",
    text: "Analyze this monologue for text and subtext. Can you suggest a way to layer the emotional stakes so the performance grows in intensity?",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-3",
    text: "Help me identify the core Archetype present in this scene. Once identified, lead me through a step-by-step exercise to find where that archetype lives in my physical center and help me map out how it changes my posture, gaze, and movement.",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-4",
    text: "I'm struggling to make this dialogue feel natural. Can we run a 'Phone Call' exercise where I 'call' the other character to find the urgent reason I need to speak these lines?",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-5",
    text: "Identify the Inner Objects in this script. Who or what from my personal experience can I use to make these stakes feel high and immediate?",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-6",
    text: "Looking at this classical text, identify the 'key' words. Suggest a vocal exercise to help me ground the resonance in my body while keeping the thought clear.",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-7",
    text: "Help me build the Moment Before. Suggest three different 'entrances'—three different previous circumstances and how each one changes the first line of the scene.",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-8",
    text: "I need a Substitution for this scene. Who in my life triggers the specific 'need for approval' this character is chasing?",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-9",
    text: "Walk me through the 'Six Steps' for this character: Who am I? What are the circumstances? What are my relationships? What do I want? What is my obstacle? What do I do to get what I want?",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-10",
    text: "This scene involves a specific prop. How can I use the Endowment exercise to give this object a physical or emotional weight that isn't actually there?",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-11",
    text: "Break this scene into Beats. For every beat, give me one 'Active Verb' (e.g., to prod, to seduce, to crush) to guide my intention.",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-12",
    text: "What is the Subtext of this specific exchange? What is my character saying 'between the lines' to manipulate the other person?",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-13",
    text: "Help me write an Inner Monologue for the moments I am listening. What am I thinking that I cannot say out loud?",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-14",
    text: "Identify the internal and external Obstacles in this scene. Suggest an exercise to help me 'fight' against them physically.",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-15",
    text: "What are the Personal Rules of this character? What would they consider a 'win' in this specific social interaction?",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-16",
    text: "If I were to apply an 'As If' scenario to this situation—something from my own life—what would it be to match the high stakes of the script?",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-17",
    text: "Analyze the meter and rhythm of this speech. Where does the punctuation suggest a shift in the character's thought process?",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-18",
    text: "Suggest three 'Doings' (physical tasks) I can perform during this scene that reveal the character's state of mind without using words.",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-19",
    text: "How can I look at this character's 'pain' or 'loss' and find a way to turn it into a proactive drive to win?",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-20",
    text: "I've just finished a take. Based on these script requirements, what are three specific things I should check in my next 'pass' to ensure I'm staying truthful?",
    category: "actors_craft",
    placeholderKeys: [],
  },
  {
    id: "craft-21",
    text: "Help me create a brief Character History of the 24 hours leading up to this scene. What did I eat, who did I talk to, and why am I here now?",
    category: "actors_craft",
    placeholderKeys: [],
  },

  // --- The Actor's Career (20 Prompts) ---
  {
    id: "career-1",
    text: "Based on my current portfolio, what is my Unique Selling Point? How do I stand out in a crowded casting room?",
    category: "actors_career",
    placeholderKeys: [],
  },
  {
    id: "career-2",
    text: "Help me draft a professional intro email to [Agents Website] that highlights my recent training and specific 'type' without being overly formal.",
    category: "actors_career",
    placeholderKeys: ["Agents Website"],
  },
  {
    id: "career-3",
    text: "I'm meeting [Casting Director] who works mostly in [Genre]. What are the key stylistic markers I should be aware of in their previous projects?",
    category: "actors_career",
    placeholderKeys: ["Casting Director", "Genre"],
  },
  {
    id: "career-4",
    text: "If I am a [Description of physical/vibe], what are the top 5 TV shows currently filming that I would realistically be cast in?",
    category: "actors_career",
    placeholderKeys: ["Description of physical/vibe"],
  },
  {
    id: "career-5",
    text: "How do I reach out to [Director] I admire on social media in a way that is professional and value-driven?",
    category: "actors_career",
    placeholderKeys: ["Director"],
  },
  {
    id: "career-6",
    text: "What are three things I can do right now to make my [Acting Profile URL] look more professional to a high-level agent?",
    category: "actors_career",
    placeholderKeys: ["Acting Profile URL"],
  },
  {
    id: "career-7",
    text: "I have a meeting with [agent]. What are three questions I should ask to ensure our artistic visions align?",
    category: "actors_career",
    placeholderKeys: ["agent"],
  },
  {
    id: "career-8",
    text: "I have [upload headshots]. How do I choose the 'Main' one based on which casting bracket is currently most active?",
    category: "actors_career",
    placeholderKeys: ["upload headshots"],
  },
  {
    id: "career-9",
    text: "Can you help me storyboard a 1-minute self-tape reel that shows two completely contrasting sides of my acting range?",
    category: "actors_career",
    placeholderKeys: [],
  },
  {
    id: "career-10",
    text: "I have a 3-hour turnaround for a tape. What is a step-by-step workflow to ensure I get a great take without panicking?",
    category: "actors_career",
    placeholderKeys: [],
  },
  {
    id: "career-11",
    text: "I sent a tape two weeks ago and haven't heard back. Help me write a short, polite 'check-in' that keeps me on their radar.",
    category: "actors_career",
    placeholderKeys: [],
  },
  {
    id: "career-12",
    text: "If my acting brand were [description] Help me find my Brand Keywords.",
    category: "actors_career",
    placeholderKeys: ["description"],
  },
  {
    id: "career-13",
    text: "How can I share 'behind the scenes' content from my training that builds my authority as an actor?",
    category: "actors_career",
    placeholderKeys: [],
  },
  {
    id: "career-14",
    text: "What are the 'industry standard' technical requirements for a self-tape in 2026 regarding lighting and audio?",
    category: "actors_career",
    placeholderKeys: [],
  },
  {
    id: "career-15",
    text: "I'm looking to work in [Region/City]. Who are the top 5 Casting Directors there I should be following?",
    category: "actors_career",
    placeholderKeys: ["Region/City"],
  },
  {
    id: "career-16",
    text: "I'm auditioning for a Director who likes [Specific Style]. How do I adapt my natural performance to fit that aesthetic?",
    category: "actors_career",
    placeholderKeys: ["Specific Style"],
  },
  {
    id: "career-17",
    text: "Help me write a script for a 'Slate' or 'About Me' video that feels authentic and shows my personality.",
    category: "actors_career",
    placeholderKeys: [],
  },
  {
    id: "career-18",
    text: "Based on the character description '[Insert]', what wardrobe 'suggestions' (not costumes) would help me embody the role?",
    category: "actors_career",
    placeholderKeys: ["Insert"],
  },
  {
    id: "career-19",
    text: "I've done a lot of theater but want to move into Film/TV. What are the first three steps to re-branding myself for the screen?",
    category: "actors_career",
    placeholderKeys: [],
  },
  {
    id: "career-20",
    text: "What are common 'red flags' in a boutique agency contract that I should discuss with a legal advisor?",
    category: "actors_career",
    placeholderKeys: [],
  },

  // --- The Actor's Mindset (20 Prompts) ---
  {
    id: "mindset-1",
    text: "I didn't get the role. Help me run a 'Post-Mortem' exercise to see what I learned, then help me 'release' the scene.",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-2",
    text: "I'm in the waiting room and my heart is racing. Give me a quick centering exercise to get back into my body.",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-3",
    text: "I'm currently 'between jobs.' Help me design a 90-minute daily training schedule that covers voice, movement, and script work.",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-4",
    text: "I feel like I'm 'behind' my peers. Lead me through a short mental exercise to refocus on my own unique path.",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-5",
    text: "I've done 10 tapes this month and I'm exhausted. How do I maintain my creative spark when it feels like a factory line?",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-6",
    text: "Suggest a morning routine that includes 'morning pages' or creative visualization to prime my brain for acting work.",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-7",
    text: "What are three tangible actions I can take today to feel proactive again?",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-8",
    text: "Tell me the science behind why anxiety and excitement feel the same, and give me a trick to 're-label' my nerves.",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-9",
    text: "I feel 'scattered' today. Can you lead me through a grounding exercise using my five senses?",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-10",
    text: "I'm playing it 'safe' in rehearsals. Give me a mental challenge to help me take a massive risk in my next take.",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-11",
    text: "Look at my recent 'failures.' How can we reframe each one as a specific data point for improvement?",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-12",
    text: "It's my first day on a professional set. What is a mental strategy for staying focused amidst all the technical distractions?",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-13",
    text: "Give me an affirmation that reminds me I am an artist with something to say, regardless of my current employment status.",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-14",
    text: "How do I set creative boundaries so that I don't take my character's trauma home with me at the end of the day?",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-15",
    text: "How can I track my training consistency so I can see my progress over a 30-day period?",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-16",
    text: "Suggest a physical ritual like a specific [walk or other] to signify that 'the work is done' and I can let it go.",
    category: "actors_mindset",
    placeholderKeys: ["walk or other"],
  },
  {
    id: "mindset-17",
    text: "How do I stop trying to 'please' the casting director and focus entirely on the truth of the character?",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-18",
    text: "I'm feeling jaded. What was the first moment I fell in love with acting? Help me reconnect with that feeling today.",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-19",
    text: "I don't feel 'inspired' to work today. Give me a discipline-based task that takes the pressure off 'feeling' it.",
    category: "actors_mindset",
    placeholderKeys: [],
  },
  {
    id: "mindset-20",
    text: "How do I maintain my artistic integrity while still playing the 'industry game'?",
    category: "actors_mindset",
    placeholderKeys: [],
  },

  // --- Profile Management (6 Prompts) ---
  {
    id: "profile-bio",
    text: "Write a professional bio for me based on my DNA profile and acting style",
    category: "profile_management",
    placeholderKeys: [],
  },
  {
    id: "profile-bio-update",
    text: "Set my bio to: [new bio text]",
    category: "profile_management",
    placeholderKeys: ["new bio text"],
  },
  {
    id: "profile-headshot",
    text: "Suggest criteria for choosing a main headshot for my profile",
    category: "profile_management",
    placeholderKeys: [],
  },
  {
    id: "profile-credits",
    text: "Set my credits to: [credit title], [role], [year], [category]",
    category: "profile_management",
    placeholderKeys: ["credit title", "role", "year", "category"],
  },
  {
    id: "profile-skills",
    text: "Set my skills and accents to [new skills list]",
    category: "profile_management",
    placeholderKeys: ["new skills list"],
  },
  {
    id: "profile-training",
    text: "Set my training to include: [institution], [qualification], [years], [category]",
    category: "profile_management",
    placeholderKeys: ["institution", "qualification", "years", "category"],
  },
];