import { SchemaType, FunctionDeclaration, FunctionDeclarationsTool } from 'firebase/ai';

export const EXTRACTION_FUNCTION_DECLARATION: FunctionDeclaration = {
  name: "update_master_profile",
  description: "Analyzes the conversation history and the latest user input to extract NEW psychological data. DO NOT extract if the user is repeating themselves, making small talk, or providing superficial answers.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      is_valuable_extraction: {
        type: SchemaType.BOOLEAN,
        description: "TRUE if the user provided new, deep, and actionable psychological insights. FALSE if it is small talk, repetitive, or superficial."
      },
      new_traits: {
        type: SchemaType.ARRAY,
        description: "A list of NEW psychological traits, fears, or core needs discovered in this specific turn.",
        items: { type: SchemaType.STRING }
      },
      defense_mechanisms: {
        type: SchemaType.ARRAY,
        description: "Any NEW behavioral defense mechanisms observed (e.g., 'uses humor to deflect', 'intellectualizes emotions').",
        items: { type: SchemaType.STRING }
      },
      leaf_snippets: {
        type: SchemaType.ARRAY,
        description: "Exact, verbatim quotes from the actor's latest message that justify these new insights. Only include highly impactful quotes.",
        items: { type: SchemaType.STRING }
      },
      holistic_analysis: {
        type: SchemaType.STRING,
        description: "A brief psychological inference drawing connections between the current message and the broader conversation history. What is the subtext?"
      },
      somatic_tells: {
        type: SchemaType.ARRAY,
        description: "Involuntary physical or physiological reactions the actor mentions (e.g., 'jaw tension', 'shallow breathing', 'avoiding eye contact', 'throat closing'). Crucial for acting.",
        items: { type: SchemaType.STRING }
      },
      core_values: {
        type: SchemaType.ARRAY,
        description: "Fundamental beliefs, ethics, or moral baselines the user operates from (e.g., 'radical honesty', 'loyalty above all').",
        items: { type: SchemaType.STRING }
      },
      relational_dynamics: {
        type: SchemaType.ARRAY,
        description: "How the user relates to others, particularly regarding power, submission, intimacy, or attachment (e.g., 'needs to be the caretaker', 'rebels against authority').",
        items: { type: SchemaType.STRING }
      },
      milestones: {
        type: SchemaType.ARRAY,
        description: "Significant life events, traumas, or 'big wins' shared in this turn. Summarize the event and its emotional cost.",
        items: {
          type: SchemaType.OBJECT,
          properties: {
            event: { type: SchemaType.STRING, description: "The specific memory or event." },
            emotional_cost: { type: SchemaType.STRING, description: "The hidden toll or psychological impact it had on them." }
          }
        }
      },
      core_wounds_and_fears: {
        type: SchemaType.ARRAY,
        description: "Deep psychological scars or fundamental fears driving the user (e.g., 'fear of abandonment', 'terror of being average', 'childhood rejection').",
        items: { type: SchemaType.STRING }
      },
      unmet_needs: {
        type: SchemaType.ARRAY,
        description: "The underlying desires or objectives the user is subconsciously chasing (e.g., 'desperate need for parental validation', 'need to be the smartest in the room').",
        items: { type: SchemaType.STRING }
      },
      public_masks: {
        type: SchemaType.ARRAY,
        description: "The social personas or behavioral shields the user wears to hide their wounds (e.g., 'the untouchable stoic', 'the people-pleasing joker', 'the aggressive overachiever').",
        items: { type: SchemaType.STRING }
      },
      emotional_baseline: {
        type: SchemaType.OBJECT,
        description: "The actor's emotional operating system.",
        properties: {
          conflict_response: { type: SchemaType.STRING, description: "How they navigate conflict (e.g., 'righteous anger', 'resolute patience', 'withdrawal')." },
          internal_friction: { type: SchemaType.STRING, description: "Suppressed emotions or recurring frustrations (e.g., 'feeling constantly misunderstood', 'boiling resentment')." },
          vulnerability_management: { type: SchemaType.STRING, description: "How they handle intimacy or exposure (e.g., 'deflects with humor', 'intellectualizes')." }
        }
      },
      intellectual_framework: {
        type: SchemaType.OBJECT,
        description: "How the actor's brain processes information and narrative.",
        properties: {
          cognitive_style: { type: SchemaType.STRING, description: "How they process tasks (e.g., 'structural/logical', 'chaotic/instinctive')." },
          attention_to_detail: { type: SchemaType.STRING, description: "Their pacing and focus (e.g., 'hyper-perfectionist', 'big-picture thinker')." }
        }
      },
      archetype_signals: {
        type: SchemaType.ARRAY,
        description: "Inferred archetypal patterns. These are whispers, not headlines (e.g., 'The Protector', 'The Martyr', 'The Rebel').",
        items: { type: SchemaType.STRING }
      },
      key_entities_and_arenas: {
        type: SchemaType.ARRAY,
        description: "Important people, places, or specific subcultures mentioned in the actor's stories (e.g., 'mother', 'tech industry', 'high school theatre').",
        items: { type: SchemaType.STRING }
      },
      progress_assessment: {
        type: SchemaType.OBJECT,
        properties: {
          has_actionable_pattern: { type: SchemaType.BOOLEAN, description: "True ONLY if genuinely new, playable, and useful patterns were revealed. False if it's repetitive or shallow." },
          depth_score: { type: SchemaType.NUMBER, description: "Score from 0 to 10 evaluating the emotional depth and vulnerability of the latest answer." }
        },
        required: ["has_actionable_pattern", "depth_score"]
      }
    },
    required: ["progress_assessment"]
  }
};

export const EXTRACTION_TOOL: FunctionDeclarationsTool = {
  functionDeclarations: [EXTRACTION_FUNCTION_DECLARATION]
};
