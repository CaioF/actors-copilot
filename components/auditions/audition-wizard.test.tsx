/** @jest-environment jsdom */
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockPush = jest.fn();

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
  updateDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  serverTimestamp: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: mockPush,
  })),
}));

jest.mock("react-to-print", () => ({
  useReactToPrint: jest.fn(() => jest.fn()),
}));

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { AuditionWizard } from "./audition-wizard";
import { StepUpload } from "./step/step-upload";
import { MemoryRecordingBanner } from "@/components/memory-recording-banner";

class IntersectionObserverMock {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
  takeRecords = jest.fn(() => []);
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: IntersectionObserverMock,
});

Object.defineProperty(global, "IntersectionObserver", {
  writable: true,
  value: IntersectionObserverMock,
});

describe("AuditionWizard", () => {
  describe("handleNext", () => {
    it("increments step from 1 to 2", () => {
      render(<AuditionWizard mode="sides" />);
      
      expect(screen.getByText("Basics")).toBeInTheDocument();
      
      const nextButton = screen.getByRole("button", { name: "Next" });
      fireEvent.click(nextButton);
      
      expect(screen.getByText(/Upload Sides/i)).toBeInTheDocument();
    });

    it("caps step at 4 when already at maximum", () => {
      render(<AuditionWizard mode="sides" />);
      
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      
      expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
      expect(screen.getByText("Review & Generate")).toBeInTheDocument();
    });
  });

  describe("handleBack", () => {
    it("decrements step from 2 to 1", () => {
      render(<AuditionWizard mode="sides" />);
      
      const nextButton = screen.getByRole("button", { name: "Next" });
      fireEvent.click(nextButton);
      
      expect(screen.getByText(/Upload Sides/i)).toBeInTheDocument();
      
      const backButton = screen.getByRole("button", { name: "Back" });
      fireEvent.click(backButton);
      
      expect(screen.getByText("Basics")).toBeInTheDocument();
    });

    it("floors at step 1 when already at minimum", () => {
      render(<AuditionWizard mode="sides" />);
      
      expect(screen.getByText("Basics")).toBeInTheDocument();
      
      const backButtons = screen.queryAllByRole("button", { name: "Back" });
      expect(backButtons.length).toBe(0);
    });
  });

  describe("updateFormData", () => {
    it("merges partial data correctly and preserves existing keys", () => {
      render(<AuditionWizard mode="sides" />);
      
      const projectInput = screen.getByPlaceholderText("e.g., The Morning Show Season 5");
      fireEvent.change(projectInput, { target: { value: "Test Project" } });
      
      const roleInput = screen.getByPlaceholderText("e.g., Dr. Sarah Chen");
      fireEvent.change(roleInput, { target: { value: "Test Role" } });
      
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

describe("AuditionWizard enrichment (Task 3)", () => {
  const generatedSidesResult = {
    intro: "Sides intro",
    sections: [{ title: "Objective", items: ["Play the truth"] }],
    outro: "Sides outro",
  };
  const generatedBriefResult = {
    intro: "Brief intro",
    sections: [{ title: "Checklist", items: ["Do the prep"] }],
    outro: "Brief outro",
  };
  const mockUser = { uid: "user123", displayName: "Actor Test", getIdToken: jest.fn().mockResolvedValue("token") };
  const firebaseModule = require("@/lib/firebase");
  const authModule = require("firebase/auth");
  const firestoreModule = require("firebase/firestore");
  const mockFetch = jest.fn();

  const createResponse = (body: unknown, ok = true) => ({
    ok,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  });

  const goToGeneratedResult = async (mode: "sides" | "brief", result: typeof generatedSidesResult, auditionId?: string) => {
    render(<AuditionWizard mode={mode} auditionId={auditionId} />);

    fireEvent.change(screen.getByPlaceholderText("e.g., The Morning Show Season 5"), {
      target: { value: "Hamlet" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g., Dr. Sarah Chen"), {
      target: { value: "Ophelia" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    mockFetch
      .mockResolvedValueOnce(createResponse({ ok: true }))
      .mockResolvedValueOnce(createResponse({ data: result }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /generate breakdown/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save output/i })).toBeInTheDocument();
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    Object.defineProperty(global, "fetch", {
      writable: true,
      value: mockFetch,
    });

    firebaseModule.getDb.mockReturnValue({});
    authModule.getAuth.mockReturnValue({ currentUser: mockUser });
    authModule.onAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: typeof mockUser | null) => void) => {
      cb(mockUser);
      return jest.fn();
    });
    firestoreModule.collection.mockReturnValue({ id: "auditions-ref" });
    firestoreModule.doc.mockImplementation((_db: unknown, path: string) => ({ path }));
    firestoreModule.addDoc.mockResolvedValue({ id: "new-doc-id" });
    firestoreModule.updateDoc.mockResolvedValue(undefined);
    firestoreModule.serverTimestamp.mockReturnValue("SERVER_TS");
  });

  it("uses updateDoc and preserves existing sidesPerformanceMap when saving a brief enrichment", async () => {
    const existingSidesMap = {
      intro: "Existing sides intro",
      sections: [{ title: "Existing Objective", items: ["Hold on tighter"] }],
      outro: "Existing sides outro",
    };

    firestoreModule.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        project: "Hamlet",
        role: "Ophelia",
        deadline: "2026-06-15T14:00",
        auditionTimezone: "America/Los_Angeles",
        actorLocalDeadline: "Jun 15, 2026 2:00 PM",
        castingDirectorName: "Nina Gold",
        performanceMap: existingSidesMap,
        sidesPerformanceMap: existingSidesMap,
        briefPerformanceMap: null,
        hasSides: true,
        hasBrief: false,
        analysisType: "sides",
        createdAt: "OLD_TS",
        status: "completed",
      }),
    });

    await goToGeneratedResult("brief", generatedBriefResult, "audition-brief");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save output/i }));
    });

    await waitFor(() => {
      expect(firestoreModule.updateDoc).toHaveBeenCalledTimes(1);
    });

    expect(firestoreModule.addDoc).not.toHaveBeenCalled();
    expect(firestoreModule.updateDoc).toHaveBeenCalledWith(
      { path: "users/user123_Actor/auditions/audition-brief" },
      expect.objectContaining({
        analysisType: "sides",
        performanceMap: existingSidesMap,
        sidesPerformanceMap: existingSidesMap,
        briefPerformanceMap: generatedBriefResult,
        hasSides: true,
        hasBrief: true,
        castingDirectorName: "Nina Gold",
        deadline: "2026-06-15T14:00",
        auditionTimezone: "America/Los_Angeles",
        actorLocalDeadline: "Jun 15, 2026 2:00 PM",
      })
    );
    expect(mockPush).toHaveBeenCalledWith("/auditions");
  });

  it("uses updateDoc and preserves existing briefPerformanceMap when taking a sides enrichment to coach", async () => {
    const existingBriefMap = {
      intro: "Existing brief intro",
      sections: [{ title: "Existing Checklist", items: ["Know the brief"] }],
      outro: "Existing brief outro",
    };

    firestoreModule.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        project: "Hamlet",
        role: "Ophelia",
        deadline: null,
        auditionTimezone: null,
        actorLocalDeadline: null,
        castingDirectorName: "Nina Gold",
        performanceMap: existingBriefMap,
        sidesPerformanceMap: null,
        briefPerformanceMap: existingBriefMap,
        hasSides: false,
        hasBrief: true,
        analysisType: "brief",
        createdAt: "OLD_TS",
        status: "completed",
      }),
    });

    await goToGeneratedResult("sides", generatedSidesResult, "audition-sides");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /take this to my coach/i }));
    });

    await waitFor(() => {
      expect(firestoreModule.updateDoc).toHaveBeenCalledTimes(1);
    });

    expect(firestoreModule.addDoc).not.toHaveBeenCalled();
    expect(firestoreModule.updateDoc).toHaveBeenCalledWith(
      { path: "users/user123_Actor/auditions/audition-sides" },
      expect.objectContaining({
        analysisType: "brief",
        performanceMap: existingBriefMap,
        sidesPerformanceMap: generatedSidesResult,
        briefPerformanceMap: existingBriefMap,
        hasSides: true,
        hasBrief: true,
        castingDirectorName: "Nina Gold",
      })
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("/acting-coach?auditionId=audition-sides")
    );
  });

  it("writes legacy and dual-map fields when saving a new sides audition", async () => {
    await goToGeneratedResult("sides", generatedSidesResult);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save output/i }));
    });

    await waitFor(() => {
      expect(firestoreModule.addDoc).toHaveBeenCalledTimes(1);
    });

    expect(firestoreModule.updateDoc).not.toHaveBeenCalled();
    expect(firestoreModule.addDoc).toHaveBeenCalledWith(
      { id: "auditions-ref" },
      expect.objectContaining({
        project: "Hamlet",
        role: "Ophelia",
        performanceMap: generatedSidesResult,
        analysisType: "sides",
        sidesPerformanceMap: generatedSidesResult,
        briefPerformanceMap: null,
        hasSides: true,
        hasBrief: false,
        createdAt: "SERVER_TS",
        status: "completed",
      })
    );
    expect(mockPush).toHaveBeenCalledWith("/auditions");
  });

  it("accepts auditionId prop without breaking render in both modes", () => {
    const { rerender } = render(<AuditionWizard mode="sides" auditionId="test-id" />);
    expect(screen.getByText("Basics")).toBeInTheDocument();

    rerender(<AuditionWizard mode="brief" auditionId="test-id" />);
    expect(screen.getByText("Basics")).toBeInTheDocument();
  });
});

describe("AuditionWizard deduplication guard (Task 3b)", () => {
  const generatedSidesResult = {
    intro: "Sides intro",
    sections: [{ title: "Objective", items: ["Play the truth"] }],
    outro: "Sides outro",
  };
  const mockUser = { uid: "user123", displayName: "Actor Test", getIdToken: jest.fn().mockResolvedValue("token") };
  const firebaseModule = require("@/lib/firebase");
  const authModule = require("firebase/auth");
  const firestoreModule = require("firebase/firestore");
  const mockFetch = jest.fn();

  const createResponse = (body: unknown, ok = true) => ({
    ok,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  });

  const goToGeneratedResult = async (mode: "sides" | "brief", result: typeof generatedSidesResult) => {
    render(<AuditionWizard mode={mode} />);

    fireEvent.change(screen.getByPlaceholderText("e.g., The Morning Show Season 5"), {
      target: { value: "Hamlet" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g., Dr. Sarah Chen"), {
      target: { value: "Ophelia" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    mockFetch
      .mockResolvedValueOnce(createResponse({ ok: true }))
      .mockResolvedValueOnce(createResponse({ data: result }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /generate breakdown/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save output/i })).toBeInTheDocument();
    });
  };

  const duplicateDoc = {
    exists: () => true,
    id: "duplicate-id",
    data: () => ({
      project: "Hamlet",
      role: "Ophelia",
      analysisType: "sides",
      sidesPerformanceMap: { intro: "dup", sections: [{ title: "Dup", items: ["dup"] }], outro: "dup" },
      hasSides: true,
      hasBrief: false,
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    Object.defineProperty(global, "fetch", {
      writable: true,
      value: mockFetch,
    });
    global.confirm = jest.fn();

    firebaseModule.getDb.mockReturnValue({});
    authModule.getAuth.mockReturnValue({ currentUser: mockUser });
    authModule.onAuthStateChanged.mockImplementation((_auth: unknown, cb: (u: typeof mockUser | null) => void) => {
      cb(mockUser);
      return jest.fn();
    });
    firestoreModule.collection.mockReturnValue({ id: "auditions-ref" });
    firestoreModule.doc.mockImplementation((_db: unknown, path: string) => ({ path }));
    firestoreModule.query.mockReturnValue({ id: "query-ref" });
    firestoreModule.where.mockReturnValue({ id: "where-clause" });
    firestoreModule.addDoc.mockResolvedValue({ id: "new-doc-id" });
    firestoreModule.updateDoc.mockResolvedValue(undefined);
    firestoreModule.serverTimestamp.mockReturnValue("SERVER_TS");
  });

  describe("handleSaveAndFinish deduplication", () => {
    it("shows confirmation dialog when duplicate exists for same project/role/analysisType", async () => {
      firestoreModule.getDocs.mockResolvedValue({ docs: [duplicateDoc] });

      await goToGeneratedResult("sides", generatedSidesResult);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save output/i }));
      });

      expect(global.confirm).toHaveBeenCalledWith(
        "You already have a sides analysis for 'Hamlet' as 'Ophelia'. Would you like to enrich the existing audition instead?"
      );
    });

    it("navigates to enrichment URL when user confirms duplicate dialog (Save Output path)", async () => {
      firestoreModule.getDocs.mockResolvedValue({ docs: [duplicateDoc] });
      global.confirm.mockReturnValue(true);

      await goToGeneratedResult("sides", generatedSidesResult);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save output/i }));
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/auditions/new/brief?enrichAuditionId=duplicate-id");
      });
      expect(firestoreModule.addDoc).not.toHaveBeenCalled();
      expect(firestoreModule.updateDoc).not.toHaveBeenCalled();
    });

    it("proceeds with addDoc when user declines duplicate dialog (Save Output path)", async () => {
      firestoreModule.getDocs.mockResolvedValue({ docs: [duplicateDoc] });
      global.confirm.mockReturnValue(false);

      await goToGeneratedResult("sides", generatedSidesResult);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save output/i }));
      });

      await waitFor(() => {
        expect(firestoreModule.addDoc).toHaveBeenCalledTimes(1);
      });
      expect(mockPush).toHaveBeenCalledWith("/auditions");
    });

    it("proceeds directly to addDoc without dialog when project/role do not match existing", async () => {
      firestoreModule.getDocs.mockResolvedValue({ docs: [] });

      await goToGeneratedResult("sides", generatedSidesResult);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save output/i }));
      });

      expect(global.confirm).not.toHaveBeenCalled();
      expect(firestoreModule.addDoc).toHaveBeenCalledTimes(1);
    });

    it("skips deduplication check when project is empty", async () => {
      render(<AuditionWizard mode="sides" />);

      fireEvent.change(screen.getByPlaceholderText("e.g., The Morning Show Season 5"), {
        target: { value: "" },
      });
      fireEvent.change(screen.getByPlaceholderText("e.g., Dr. Sarah Chen"), {
        target: { value: "Ophelia" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      fireEvent.click(screen.getByRole("button", { name: "Next" }));

      mockFetch
        .mockResolvedValueOnce(createResponse({ ok: true }))
        .mockResolvedValueOnce(createResponse({ data: generatedSidesResult }));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /generate breakdown/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save output/i })).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save output/i }));
      });

      expect(firestoreModule.getDocs).not.toHaveBeenCalled();
      expect(firestoreModule.addDoc).toHaveBeenCalledTimes(1);
    });

    it("skips deduplication check when role is empty", async () => {
      render(<AuditionWizard mode="sides" />);

      fireEvent.change(screen.getByPlaceholderText("e.g., The Morning Show Season 5"), {
        target: { value: "Hamlet" },
      });
      fireEvent.change(screen.getByPlaceholderText("e.g., Dr. Sarah Chen"), {
        target: { value: "" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      fireEvent.click(screen.getByRole("button", { name: "Next" }));

      mockFetch
        .mockResolvedValueOnce(createResponse({ ok: true }))
        .mockResolvedValueOnce(createResponse({ data: generatedSidesResult }));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /generate breakdown/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save output/i })).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save output/i }));
      });

      expect(firestoreModule.getDocs).not.toHaveBeenCalled();
      expect(firestoreModule.addDoc).toHaveBeenCalledTimes(1);
    });

    it("gracefully falls back to addDoc when Firestore query throws (index not ready)", async () => {
      firestoreModule.getDocs.mockRejectedValue(new Error("Firestore index not ready"));

      await goToGeneratedResult("sides", generatedSidesResult);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save output/i }));
      });

      await waitFor(() => {
        expect(firestoreModule.addDoc).toHaveBeenCalledTimes(1);
      });
      expect(global.confirm).not.toHaveBeenCalled();
    });

    it("skips deduplication when auditionId prop is set (enrichment mode)", async () => {
      firestoreModule.getDocs.mockResolvedValue({ docs: [duplicateDoc] });

      const existingBriefMap = {
        intro: "Existing brief intro",
        sections: [{ title: "Existing Checklist", items: ["Know the brief"] }],
        outro: "Existing brief outro",
      };

      firestoreModule.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          project: "Hamlet",
          role: "Ophelia",
          sidesPerformanceMap: null,
          briefPerformanceMap: existingBriefMap,
          hasSides: false,
          hasBrief: true,
          analysisType: "brief",
          createdAt: "OLD_TS",
          status: "completed",
        }),
      });

      render(<AuditionWizard mode="sides" auditionId="enrichment-id" />);

      fireEvent.change(screen.getByPlaceholderText("e.g., The Morning Show Season 5"), {
        target: { value: "Hamlet" },
      });
      fireEvent.change(screen.getByPlaceholderText("e.g., Dr. Sarah Chen"), {
        target: { value: "Ophelia" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      fireEvent.click(screen.getByRole("button", { name: "Next" }));

      mockFetch
        .mockResolvedValueOnce(createResponse({ ok: true }))
        .mockResolvedValueOnce(createResponse({ data: generatedSidesResult }));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /generate breakdown/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /save output/i })).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save output/i }));
      });

      expect(firestoreModule.getDocs).not.toHaveBeenCalled();
      expect(firestoreModule.updateDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleCoachClick deduplication", () => {
    it("shows confirmation dialog when duplicate exists for same project/role/analysisType (coach path)", async () => {
      firestoreModule.getDocs.mockResolvedValue({ docs: [duplicateDoc] });

      await goToGeneratedResult("sides", generatedSidesResult);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /take this to my coach/i }));
      });

      expect(global.confirm).toHaveBeenCalledWith(
        "You already have a sides analysis for 'Hamlet' as 'Ophelia'. Would you like to enrich the existing audition instead?"
      );
    });

    it("navigates to enrichment URL without creating doc when user confirms (coach path)", async () => {
      firestoreModule.getDocs.mockResolvedValue({ docs: [duplicateDoc] });
      global.confirm.mockReturnValue(true);

      await goToGeneratedResult("sides", generatedSidesResult);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /take this to my coach/i }));
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/auditions/new/brief?enrichAuditionId=duplicate-id");
      });
      expect(firestoreModule.addDoc).not.toHaveBeenCalled();
      expect(firestoreModule.updateDoc).not.toHaveBeenCalled();
    });

    it("proceeds through coach save flow when user declines duplicate dialog", async () => {
      firestoreModule.getDocs.mockResolvedValue({ docs: [duplicateDoc] });
      global.confirm.mockReturnValue(false);

      await goToGeneratedResult("sides", generatedSidesResult);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /take this to my coach/i }));
      });

      await waitFor(() => {
        expect(firestoreModule.addDoc).toHaveBeenCalledTimes(1);
      });
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("/acting-coach?auditionId=new-doc-id")
      );
    });

    it("proceeds directly to coach save without dialog when project/role do not match existing", async () => {
      firestoreModule.getDocs.mockResolvedValue({ docs: [] });

      await goToGeneratedResult("sides", generatedSidesResult);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /take this to my coach/i }));
      });

      expect(global.confirm).not.toHaveBeenCalled();
      expect(firestoreModule.addDoc).toHaveBeenCalledTimes(1);
    });

    it("gracefully falls back through coach flow when Firestore query throws (index not ready)", async () => {
      firestoreModule.getDocs.mockRejectedValue(new Error("Firestore index not ready"));

      await goToGeneratedResult("sides", generatedSidesResult);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /take this to my coach/i }));
      });

      await waitFor(() => {
        expect(firestoreModule.addDoc).toHaveBeenCalledTimes(1);
      });
      expect(global.confirm).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("/acting-coach?auditionId=new-doc-id")
      );
    });

    it("skips deduplication check in coach flow when auditionId prop is set (enrichment mode)", async () => {
      firestoreModule.getDocs.mockResolvedValue({ docs: [duplicateDoc] });

      const existingBriefMap = {
        intro: "Existing brief intro",
        sections: [{ title: "Existing Checklist", items: ["Know the brief"] }],
        outro: "Existing brief outro",
      };

      firestoreModule.getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          project: "Hamlet",
          role: "Ophelia",
          sidesPerformanceMap: null,
          briefPerformanceMap: existingBriefMap,
          hasSides: false,
          hasBrief: true,
          analysisType: "brief",
          createdAt: "OLD_TS",
          status: "completed",
        }),
      });

      render(<AuditionWizard mode="sides" auditionId="enrichment-id" />);

      fireEvent.change(screen.getByPlaceholderText("e.g., The Morning Show Season 5"), {
        target: { value: "Hamlet" },
      });
      fireEvent.change(screen.getByPlaceholderText("e.g., Dr. Sarah Chen"), {
        target: { value: "Ophelia" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      fireEvent.click(screen.getByRole("button", { name: "Next" }));

      mockFetch
        .mockResolvedValueOnce(createResponse({ ok: true }))
        .mockResolvedValueOnce(createResponse({ data: generatedSidesResult }));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /generate breakdown/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /take this to my coach/i })).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /take this to my coach/i }));
      });

      expect(firestoreModule.getDocs).not.toHaveBeenCalled();
      expect(firestoreModule.updateDoc).toHaveBeenCalledTimes(1);
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
