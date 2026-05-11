/**
 * Types for the Audition flow, including form data structure and step definitions.
 * @module
 * @exports AuditionStep, AuditionFormData, initialAuditionData, AuditionDocument, PerformanceMap, CriticalBriefFact, BriefAnalysisResult
 */

export type AuditionStep = 1 | 2 | 3 | 4 | 5; // 5 is the generating state

export interface PerformanceSection {
  title: string;
  items: string[];
}

export interface PerformanceMap {
  intro?: string;
  sections: PerformanceSection[];
  outro?: string;
}

export interface CriticalBriefFact {
  label: string;
  value: string;
  importance: "critical" | "important";
}

// Brief analyze API returns the existing PerformanceMap shape with an optional
// structured criticalBriefFacts channel carried alongside intro/sections/outro.
// The wizard currently persists that full brief result inside briefPerformanceMap
// and also mirrors criticalBriefFacts onto AuditionDocument.criticalBriefFacts
// so downstream enrichment and coaching can read a stable top-level field.
export interface BriefAnalysisResult extends PerformanceMap {
  criticalBriefFacts?: CriticalBriefFact[];
}

export interface AuditionDocument {
  project: string;
  role: string;
  deadline?: string | null;
  auditionTimezone?: string | null;
  actorLocalDeadline?: string | null;
  castingDirectorName?: string | null;
  performanceMap?: PerformanceMap | null;
  sidesPerformanceMap?: PerformanceMap | null;
  briefPerformanceMap?: PerformanceMap | null;
  criticalBriefFacts?: CriticalBriefFact[] | null;
  hasSides?: boolean;
  hasBrief?: boolean;
  analysisType?: "sides" | "brief";
  createdAt: any;
  status: string;
}

export interface AuditionFormData {
  // Step 1: Basics
  projectType: "cinematic" | "commercial" | "theater" ;
  project: string;
  role: string;
  deadline?: string;

  auditionTimezone?: string;
  castingDirectorName?: string;

  // Step 2: Sides
  sidesFile: File | null;
  sidesText: string;

  // Step 3: Brief
  briefFile: File | null;
  briefText: string;
}

export const initialAuditionData: AuditionFormData = {
  projectType: "cinematic",
  project: "",
  role: "",
  deadline: "",
  auditionTimezone: "",
  castingDirectorName: "",
  sidesFile: null,
  sidesText: "",
  briefFile: null,
  briefText: "",
};
