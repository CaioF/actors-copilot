/** @jest-environment jsdom */
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/lib/firebase", () => ({
  getDb: jest.fn(),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
  })),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(null);
    return jest.fn();
  }),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

jest.mock("react-to-print", () => ({
  useReactToPrint: jest.fn(() => jest.fn()),
}));

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { AuditionWizard } from "./autition-wizard";
import { StepUpload } from "./step/step-upload";
import { MemoryRecordingBanner } from "@/components/memory-recording-banner";

describe("AuditionWizard", () => {
  describe("handleNext", () => {
    it("increments step from 1 to 2", async () => {
      render(<AuditionWizard />);
      
      expect(screen.getByText("Basics")).toBeInTheDocument();
      
      const nextButton = screen.getByRole("button", { name: "Next" });
      await act(async () => {
        fireEvent.click(nextButton);
      });
      
      expect(screen.getByText("Sides")).toBeInTheDocument();
    });

    it("caps step at 4 when already at maximum", async () => {
      render(<AuditionWizard />);
      
      const nextButtons = screen.getAllByRole("button", { name: "Next" });
      let stepButton = nextButtons[nextButtons.length - 1];
      
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          fireEvent.click(stepButton);
        });
      }
      
      expect(screen.queryByText("Review & Generate")).toBeInTheDocument();
    });
  });

  describe("handleBack", () => {
    it("decrements step from 2 to 1", async () => {
      render(<AuditionWizard />);
      
      const nextButton = screen.getByRole("button", { name: "Next" });
      await act(async () => {
        fireEvent.click(nextButton);
      });
      
      expect(screen.getByText("Sides")).toBeInTheDocument();
      
      const backButton = screen.getByRole("button", { name: "Back" });
      await act(async () => {
        fireEvent.click(backButton);
      });
      
      expect(screen.getByText("Basics")).toBeInTheDocument();
    });

    it("floors at step 1 when already at minimum", () => {
      render(<AuditionWizard />);
      
      expect(screen.getByText("Basics")).toBeInTheDocument();
      
      const backButtons = screen.queryAllByRole("button", { name: "Back" });
      expect(backButtons.length).toBe(0);
    });
  });

  describe("updateFormData", () => {
    it("merges partial data correctly and preserves existing keys", async () => {
      render(<AuditionWizard />);
      
      const projectInput = screen.getByPlaceholderText("e.g., The Morning Show Season 5");
      await act(async () => {
        fireEvent.change(projectInput, { target: { value: "Test Project" } });
      });
      
      const roleInput = screen.getByPlaceholderText("e.g., Dr. Sarah Chen");
      await act(async () => {
        fireEvent.change(roleInput, { target: { value: "Test Role" } });
      });
      
      expect(projectInput).toHaveValue("Test Project");
      expect(roleInput).toHaveValue("Test Role");
    });
  });
});

describe("StepUpload", () => {
  const defaultProps = {
    title: "Upload Sides",
    description: "Upload the script pages",
    file: null as File | null,
    text: "",
    onFileChange: jest.fn(),
    onTextChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleDrop", () => {
    const createMockFile = (name: string, type: string) => {
      const file = new File(["content"], name, { type });
      return file;
    };

    const createDataTransfer = (files: File[]) => {
      const dataTransfer = {
        files: {
          length: files.length,
          item: (i: number) => files[i],
          [0]: files[0],
        },
      };
      return dataTransfer;
    };

    it("accepts valid PDF file", async () => {
      render(<StepUpload {...defaultProps} />);
      
      const dropZone = screen.getByText(/click to upload/i);
      const pdfFile = createMockFile("test.pdf", "application/pdf");
      const dataTransfer = createDataTransfer([pdfFile]);
      
      await act(async () => {
        fireEvent.drop(dropZone, { dataTransfer });
      });
      
      expect(defaultProps.onFileChange).toHaveBeenCalledWith(pdfFile);
    });

    it("accepts valid DOCX file by MIME type", async () => {
      render(<StepUpload {...defaultProps} />);
      
      const dropZone = screen.getByText(/click to upload/i);
      const docxFile = createMockFile("test.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      const dataTransfer = createDataTransfer([docxFile]);
      
      await act(async () => {
        fireEvent.drop(dropZone, { dataTransfer });
      });
      
      expect(defaultProps.onFileChange).toHaveBeenCalledWith(docxFile);
    });

    it("accepts valid DOCX file by extension even without correct MIME type", async () => {
      render(<StepUpload {...defaultProps} />);
      
      const dropZone = screen.getByText(/click to upload/i);
      const docxFile = createMockFile("test.docx", "application/octet-stream");
      const dataTransfer = createDataTransfer([docxFile]);
      
      await act(async () => {
        fireEvent.drop(dropZone, { dataTransfer });
      });
      
      expect(defaultProps.onFileChange).toHaveBeenCalledWith(docxFile);
    });

    it("rejects invalid file types", async () => {
      render(<StepUpload {...defaultProps} />);
      
      const dropZone = screen.getByText(/click to upload/i);
      const invalidFile = createMockFile("test.txt", "text/plain");
      const dataTransfer = createDataTransfer([invalidFile]);
      
      global.alert = jest.fn();
      
      await act(async () => {
        fireEvent.drop(dropZone, { dataTransfer });
      });
      
      expect(defaultProps.onFileChange).not.toHaveBeenCalled();
      expect(global.alert).toHaveBeenCalledWith("Please upload a PDF or Word (.docx) file.");
    });

    it("rejects image files", async () => {
      render(<StepUpload {...defaultProps} />);
      
      const dropZone = screen.getByText(/click to upload/i);
      const imageFile = createMockFile("test.jpg", "image/jpeg");
      const dataTransfer = createDataTransfer([imageFile]);
      
      global.alert = jest.fn();
      
      await act(async () => {
        fireEvent.drop(dropZone, { dataTransfer });
      });
      
      expect(defaultProps.onFileChange).not.toHaveBeenCalled();
    });

    it("rejects executable files", async () => {
      render(<StepUpload {...defaultProps} />);
      
      const dropZone = screen.getByText(/click to upload/i);
      const exeFile = createMockFile("test.exe", "application/x-msdownload");
      const dataTransfer = createDataTransfer([exeFile]);
      
      global.alert = jest.fn();
      
      await act(async () => {
        fireEvent.drop(dropZone, { dataTransfer });
      });
      
      expect(defaultProps.onFileChange).not.toHaveBeenCalled();
    });
  });
});

describe("MemoryRecordingBanner", () => {
  describe("renderButton", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      global.alert = jest.fn();
    });

    it("returns button with Mic icon and 'Capture a Memory' text when status is idle", () => {
      render(<MemoryRecordingBanner />);
      
      const idleButton = screen.getByRole("button", { name: /capture a memory/i });
      expect(idleButton).toBeInTheDocument();
      expect(screen.getByText("Capture a Memory")).toBeInTheDocument();
    });
  });
});
