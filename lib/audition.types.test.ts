/**
 * @jest-environment jsdom
 */
import { initialAuditionData, AuditionFormData } from "./audition-types";

describe("Audition Flow Types and Constants", () => {
  
  describe("initialAuditionData", () => {
    
    it("should define all required properties from the AuditionFormData interface", () => {
      // We define the expected keys strictly to ensure no fields are accidentally dropped or renamed
      const expectedKeys: Array<keyof AuditionFormData> = [
        "projectType",
        "project",
        "role",
        "deadline",
        "sidesFile",
        "sidesText",
        "briefFile",
        "briefText",
      ];

      expectedKeys.forEach((key) => {
        expect(initialAuditionData).toHaveProperty(key);
      });
      
      // Ensure no unexpected extra keys are present in the initial state
      expect(Object.keys(initialAuditionData).length).toBe(expectedKeys.length);
    });

    it("should set the default projectType to 'cinematic'", () => {
      // Cinematic is the required default baseline for the AI generation prompt
      expect(initialAuditionData.projectType).toBe("cinematic");
    });

    it("should initialize all text-based fields as empty strings", () => {
      // Prevents undefined errors when React attempts to bind these to controlled inputs
      expect(initialAuditionData.project).toBe("");
      expect(initialAuditionData.role).toBe("");
      expect(initialAuditionData.deadline).toBe("");
      expect(initialAuditionData.sidesText).toBe("");
      expect(initialAuditionData.briefText).toBe("");
    });

    it("should initialize all file-based fields strictly as null", () => {
      // Crucial for the drag-and-drop component to accurately detect an empty state
      expect(initialAuditionData.sidesFile).toBeNull();
      expect(initialAuditionData.briefFile).toBeNull();
    });
  });

  describe("AuditionFormData Interface Implementation (Runtime Validations)", () => {
    
    it("should securely merge partial state updates without dropping baseline data", () => {
      // This test acts as a structural validation to ensure the interface 
      // safely supports the Partial<AuditionFormData> update patterns used heavily in the AuditionWizard.
      const mockUpdate: Partial<AuditionFormData> = {
        projectType: "theater",
        role: "Hamlet",
      };

      const updatedState: AuditionFormData = {
        ...initialAuditionData,
        ...mockUpdate,
      };

      // Validating that new values override defaults
      expect(updatedState.projectType).toBe("theater");
      expect(updatedState.role).toBe("Hamlet");
      
      // Validating that untouched values persist
      expect(updatedState.sidesFile).toBeNull(); 
      expect(updatedState.project).toBe("");
    });

    it("should properly accept standard web File objects in file properties", () => {
      // Mocking a standard File object to ensure the interface cleanly accepts runtime browser files
      const mockFile = new File(["dummy content"], "sides.pdf", {
        type: "application/pdf",
      });

      const updatedState: AuditionFormData = {
        ...initialAuditionData,
        sidesFile: mockFile,
      };

      expect(updatedState.sidesFile).toBeInstanceOf(File);
      expect(updatedState.sidesFile?.name).toBe("sides.pdf");
      expect(updatedState.sidesFile?.type).toBe("application/pdf");
    });
  });
});