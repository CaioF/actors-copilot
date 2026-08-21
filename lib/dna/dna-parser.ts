import { DnaAttribute } from "@/components/dna-vault/DnaVaultGrid";

export interface ParsedDnaResult {
  attributes: DnaAttribute[];
  completion: number;
  aiSummary: string;
  analysisTimeline: Array<{ inference: string; section?: string; timestamp?: string }>;
  leafSnippets: Array<{ quote: string; section?: string; timestamp?: string }>;
}

/**
 * Parses raw Firestore profile data and subcollection extractions into a unified,
 * categorized DNA profile representation for the DNA Vault UI.
 * 
 * Handles schema variants:
 * - Nested objects: `psychology.traits`, `acting_fuel.coreWounds`, etc.
 * - Literal dot-syntax string keys: `"acting_fuel.archetypes"`, `"acting_fuel.coreWounds"`, `"history.milestones"`, etc.
 * - Flat keys: `traits`, `core_values`, `new_traits`, etc.
 * - `dnaAttributes` / `attributes`
 * - `profile` (synthesized AI object)
 * - `baselineSummary` / `aiSummary`
 */
export function parseDnaProfileData(docData: any, vaultDocs: any[] = []): ParsedDnaResult {
  const attributes: DnaAttribute[] = [];
  const addedNames = new Set<string>();

  const addAttr = (
    name: string,
    category: string,
    tag?: string,
    description?: string,
    strength = 0.85
  ) => {
    if (!name || typeof name !== "string") return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const lowerKey = `${category.toLowerCase()}:${trimmed.toLowerCase()}`;
    if (addedNames.has(lowerKey)) return;
    addedNames.add(lowerKey);

    attributes.push({
      id: `dna-${attributes.length}-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: trimmed,
      category,
      strength,
      description: description || undefined,
      tags: tag ? [tag] : undefined,
    });
  };

  const processObject = (data: any) => {
    if (!data || typeof data !== "object") return;

    const getArray = (...keys: string[]) => {
      for (const k of keys) {
        if (Array.isArray(data[k]) && data[k].length > 0) return data[k];
      }
      return undefined;
    };

    // 1. Direct attributes arrays
    const directAttrs = getArray("attributes", "dnaAttributes");
    if (directAttrs) {
      directAttrs.forEach((attr: any) => {
        if (typeof attr === "string") {
          addAttr(attr, "Core Traits & Persona", "Direct Trait");
        } else if (attr && typeof attr === "object" && attr.name) {
          addAttr(attr.name, attr.category || "Core Traits & Persona", attr.tags?.[0], attr.description, attr.strength);
        }
      });
    }

    // 2. Psychology
    const traits = getArray("psychology.traits", "traits", "new_traits") || data.psychology?.traits;
    if (Array.isArray(traits)) {
      traits.forEach((t: string) =>
        addAttr(t, "Core Traits & Persona", "Psychological Trait", "Extracted trait from chat session", 0.9)
      );
    }

    const defenseMechanisms = getArray("psychology.defenseMechanisms", "psychology.defense_mechanisms", "defenseMechanisms", "defense_mechanisms") || data.psychology?.defenseMechanisms;
    if (Array.isArray(defenseMechanisms)) {
      defenseMechanisms.forEach((dm: string) =>
        addAttr(dm, "Core Traits & Persona", "Defense Mechanism", "Coping mechanism & protective behavior", 0.85)
      );
    }

    const coreValues = getArray("psychology.coreValues", "psychology.core_values", "coreValues", "core_values") || data.psychology?.coreValues;
    if (Array.isArray(coreValues)) {
      coreValues.forEach((cv: string) =>
        addAttr(cv, "Values, Motivations & Emotional Reservoirs", "Core Value", "Fundamental guiding principle", 0.95)
      );
    }

    const relationalDynamics = getArray("psychology.relationalDynamics", "psychology.relational_dynamics", "relationalDynamics", "relational_dynamics") || data.psychology?.relationalDynamics;
    if (Array.isArray(relationalDynamics)) {
      relationalDynamics.forEach((rd: string) =>
        addAttr(rd, "Communication & Vocal Dynamics", "Relational Dynamic", "Interpersonal pattern and communication style", 0.8)
      );
    }

    // 3. Acting Fuel
    const coreWounds = getArray("acting_fuel.coreWounds", "acting_fuel.core_wounds", "coreWounds", "core_wounds", "core_wounds_and_fears") || data.acting_fuel?.coreWounds;
    if (Array.isArray(coreWounds)) {
      coreWounds.forEach((cw: string) =>
        addAttr(cw, "Values, Motivations & Emotional Reservoirs", "Core Wound", "Emotional reservoir & primal fear", 0.9)
      );
    }

    const unmetNeeds = getArray("acting_fuel.unmetNeeds", "acting_fuel.unmet_needs", "unmetNeeds", "unmet_needs") || data.acting_fuel?.unmetNeeds;
    if (Array.isArray(unmetNeeds)) {
      unmetNeeds.forEach((un: string) =>
        addAttr(un, "Values, Motivations & Emotional Reservoirs", "Unmet Need", "Underlying psychological driver", 0.85)
      );
    }

    const publicMasks = getArray("acting_fuel.publicMasks", "acting_fuel.public_masks", "publicMasks", "public_masks") || data.acting_fuel?.publicMasks;
    if (Array.isArray(publicMasks)) {
      publicMasks.forEach((pm: string) =>
        addAttr(pm, "Core Traits & Persona", "Public Mask", "Outer persona presented to the world", 0.85)
      );
    }

    const archetypes = getArray("acting_fuel.archetypes", "acting_fuel.archetype_signals", "archetypes", "archetype_signals") || data.acting_fuel?.archetypes;
    if (Array.isArray(archetypes)) {
      archetypes.forEach((arch: string) =>
        addAttr(arch, "Core Traits & Persona", "Archetype Signal", "Dominant character archetype", 0.9)
      );
    }

    // 4. Physicality
    const somaticTells = getArray("physicality.somaticTells", "physicality.somatic_tells", "somaticTells", "somatic_tells") || data.physicality?.somaticTells;
    if (Array.isArray(somaticTells)) {
      somaticTells.forEach((st: string) =>
        addAttr(st, "Physicality & Instincts", "Somatic Tell", "Physical response & somatic manifestation", 0.8)
      );
    }

    // 5. History
    const keyEntities = getArray("history.keyEntities", "history.key_entities", "keyEntities", "key_entities_and_arenas") || data.history?.keyEntities;
    if (Array.isArray(keyEntities)) {
      keyEntities.forEach((ke: string) =>
        addAttr(ke, "Communication & Vocal Dynamics", "Key Arena / Entity", "Significant life sphere or relational domain", 0.75)
      );
    }

    const milestones = getArray("history.milestones", "milestones") || data.history?.milestones;
    if (Array.isArray(milestones)) {
      milestones.forEach((m: any) => {
        const title = typeof m === "string" ? m : m?.event || m?.title || m?.description;
        if (title) {
          addAttr(title, "Values, Motivations & Emotional Reservoirs", "Milestone", m?.emotional_cost || "Formative life experience", 0.85);
        }
      });
    }

    // Dynamic scanner for any other string keys containing dots or arrays
    Object.keys(data).forEach((key) => {
      const val = data[key];
      if (!Array.isArray(val)) return;

      if (key.startsWith("acting_fuel.")) {
        const tag = key.replace("acting_fuel.", "");
        const category = tag === "archetypes" || tag === "publicMasks" ? "Core Traits & Persona" : "Values, Motivations & Emotional Reservoirs";
        val.forEach((item: any) => {
          if (typeof item === "string") addAttr(item, category, tag);
        });
      } else if (key.startsWith("psychology.")) {
        const tag = key.replace("psychology.", "");
        if (tag !== "analysisTimeline" && tag !== "leafSnippets") {
          val.forEach((item: any) => {
            if (typeof item === "string") addAttr(item, "Core Traits & Persona", tag);
          });
        }
      } else if (key.startsWith("history.")) {
        const tag = key.replace("history.", "");
        if (tag !== "milestones") {
          val.forEach((item: any) => {
            if (typeof item === "string") addAttr(item, "Communication & Vocal Dynamics", tag);
          });
        }
      } else if (key.startsWith("physicality.")) {
        const tag = key.replace("physicality.", "");
        val.forEach((item: any) => {
          if (typeof item === "string") addAttr(item, "Physicality & Instincts", tag);
        });
      }
    });

    // Synthesized profile object
    if (data.profile && typeof data.profile === "object") {
      Object.keys(data.profile).forEach((key) => {
        const val = data.profile[key];
        if (Array.isArray(val)) {
          val.forEach((item: any) => {
            if (typeof item === "string") {
              addAttr(item, "Core Traits & Persona", key);
            } else if (item && typeof item === "object" && item.name) {
              addAttr(item.name, item.category || "Core Traits & Persona", item.tag || key, item.description, item.strength);
            }
          });
        }
      });
    }
  };

  // Process main doc data
  if (docData) processObject(docData);

  // Process subcollection vault docs if present
  if (Array.isArray(vaultDocs)) {
    vaultDocs.forEach((doc) => {
      if (!doc) return;
      processObject(doc);
      if (doc.extractions && typeof doc.extractions === "object") {
        processObject(doc.extractions);
      }
    });
  }

  // Collect analysis timeline & leaf snippets
  const analysisTimeline: Array<{ inference: string; section?: string; timestamp?: string }> = [];
  const leafSnippets: Array<{ quote: string; section?: string; timestamp?: string }> = [];

  const timelineSource =
    docData?.["psychology.analysisTimeline"] ||
    docData?.psychology?.analysisTimeline ||
    docData?.analysisTimeline;

  if (Array.isArray(timelineSource)) {
    timelineSource.forEach((item: any) => {
      if (typeof item === "string") {
        analysisTimeline.push({ inference: item });
      } else if (item && typeof item === "object" && item.inference) {
        analysisTimeline.push({
          inference: item.inference,
          section: item.section,
          timestamp: item.timestamp,
        });
      }
    });
  }

  const snippetsSource =
    docData?.["psychology.leafSnippets"] ||
    docData?.psychology?.leafSnippets ||
    docData?.leafSnippets;

  if (Array.isArray(snippetsSource)) {
    snippetsSource.forEach((item: any) => {
      if (typeof item === "string") {
        leafSnippets.push({ quote: item });
      } else if (item && typeof item === "object" && item.quote) {
        leafSnippets.push({
          quote: item.quote,
          section: item.section,
          timestamp: item.timestamp,
        });
      }
    });
  }

  // Construct AI Summary
  let aiSummary = docData?.aiSummary || docData?.baselineSummary || "";
  if (!aiSummary && analysisTimeline.length > 0) {
    const recentInferences = analysisTimeline.slice(-3).map((item) => item.inference);
    aiSummary = recentInferences.join(" • ");
  }

  if (!aiSummary && attributes.length > 0) {
    const topTraits = attributes.slice(0, 5).map((a) => a.name).join(", ");
    aiSummary = `Extracted key psychological themes from chat interactions: ${topTraits}.`;
  }

  if (!aiSummary) {
    aiSummary = "No AI summary available yet. Chat with your AI Copilot to generate psychological insights.";
  }

  // Completion calculation based on coverage across all 4 DNA sections
  let completion = 0;
  if (typeof docData?.completion === "number" && docData.completion > 0 && docData.completion <= 1) {
    completion = docData.completion;
  } else if (typeof docData?.dnaCompletion === "number" && docData.dnaCompletion > 0 && docData.dnaCompletion <= 1) {
    completion = docData.dnaCompletion;
  } else {
    // 4 Sections, each worth 25% (0.25). 8 traits per section = 100% of that section.
    const sectionCounts: Record<string, number> = {
      "Core Traits & Persona": 0,
      "Values, Motivations & Emotional Reservoirs": 0,
      "Communication & Vocal Dynamics": 0,
      "Physicality & Instincts": 0,
    };

    attributes.forEach((attr) => {
      const cat = attr.category in sectionCounts ? attr.category : "Core Traits & Persona";
      sectionCounts[cat] = (sectionCounts[cat] || 0) + 1;
    });

    const targetPerSection = 8;
    let totalScore = 0;
    Object.values(sectionCounts).forEach((count) => {
      const sectionProgress = Math.min(1, count / targetPerSection);
      totalScore += sectionProgress * 0.25;
    });

    completion = Math.min(1, Math.max(0.05, totalScore));
  }

  return {
    attributes,
    completion,
    aiSummary,
    analysisTimeline,
    leafSnippets,
  };
}
