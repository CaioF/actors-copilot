export type AuditionStep = 1 | 2 | 3 | 4 | 5; // 5 is the generating state

export interface AuditionFormData {
  // Step 1: Basics
  project: string;
  role: string;
  deadline?: string;

  // Step 2: Sides
  sidesFile: File | null;
  sidesText: string;

  // Step 3: Brief
  briefFile: File | null;
  briefText: string;
}

export const initialAuditionData: AuditionFormData = {
  project: "",
  role: "",
  deadline: "",
  sidesFile: null,
  sidesText: "",
  briefFile: null,
  briefText: "",
};