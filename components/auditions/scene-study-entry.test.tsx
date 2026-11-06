/** @jest-environment jsdom */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockGetDb = jest.fn(() => ({}));
const mockCollection = jest.fn();
const mockGetDocs = jest.fn();
const mockQuery = jest.fn();
const mockOrderBy = jest.fn();

jest.mock("@/lib/firebase", () => ({
  getDb: () => mockGetDb(),
}));

jest.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  onAuthStateChanged: jest.fn(),
}));

jest.mock("@/components/auditions/audition-wizard", () => ({
  AuditionWizard: (props: {
    mode: string;
    auditionId?: string;
    loadSavedResult?: boolean;
  }) => (
    <div data-testid="wizard-props">
      {`${props.mode}:${props.auditionId ?? "none"}:${props.loadSavedResult ? "resume" : "blank"}`}
    </div>
  ),
}));

import { SceneStudyEntry } from "./scene-study-entry";

describe("SceneStudyEntry", () => {
  const authModule = require("firebase/auth");

  const mockUser = { uid: "user123", displayName: "Actor Test" };

  const makeDoc = (id: string, data: Record<string, unknown>) => ({
    id,
    data: () => data,
  });

  const savedAudition = {
    project: "Romeo and Juliet",
    role: "Ophelia",
    projectType: "cinematic",
    analysisType: "sides",
    status: "completed",
    hasSides: true,
    hasBrief: false,
    castingDirectorName: "Nina Gold",
    createdAt: { toDate: () => new Date("2026-11-06T00:00:00.000Z") },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDb.mockReturnValue({});
    mockCollection.mockReturnValue({ id: "auditions-ref" });
    mockOrderBy.mockReturnValue({ id: "order" });
    mockQuery.mockReturnValue({ id: "query-ref" });
    authModule.onAuthStateChanged.mockImplementation(
      (_auth: unknown, cb: (user: typeof mockUser | null) => void) => {
        cb(mockUser);
        return jest.fn();
      }
    );
  });

  // Test 1 — an existing saved audition is available from Scene Study.
  it("lists the member's saved auditions when Scene Study is opened directly", async () => {
    mockGetDocs.mockResolvedValue({ docs: [makeDoc("audition-1", savedAudition)] });

    render(<SceneStudyEntry />);

    await waitFor(() => {
      expect(screen.getByText("Romeo and Juliet")).toBeInTheDocument();
    });
    expect(screen.getByText("Ophelia")).toBeInTheDocument();
    expect(screen.getByText("Continue a saved scene")).toBeInTheDocument();
  });

  // Test 2 — selecting a saved audition loads it into Scene Study.
  it("loads the selected audition into the wizard", async () => {
    mockGetDocs.mockResolvedValue({ docs: [makeDoc("audition-1", savedAudition)] });

    render(<SceneStudyEntry />);

    await waitFor(() => {
      expect(screen.getByText("Romeo and Juliet")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Romeo and Juliet/i }));

    await waitFor(() => {
      expect(screen.getByTestId("wizard-props")).toHaveTextContent("sides:audition-1:resume");
    });
  });

  it("returns to a blank scene when the selection is cleared", async () => {
    mockGetDocs.mockResolvedValue({ docs: [makeDoc("audition-1", savedAudition)] });

    render(<SceneStudyEntry />);

    await waitFor(() => {
      expect(screen.getByText("Romeo and Juliet")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Romeo and Juliet/i }));
    await waitFor(() => {
      expect(screen.getByTestId("wizard-props")).toHaveTextContent("sides:audition-1:resume");
    });

    fireEvent.click(screen.getByRole("button", { name: /Start a new scene instead/i }));

    await waitFor(() => {
      expect(screen.getByTestId("wizard-props")).toHaveTextContent("sides:none:blank");
    });
  });

  // Test 4 — multiple auditions are all listed and each one loads on its own.
  it("shows every saved audition and loads the one that is picked", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        makeDoc("audition-1", savedAudition),
        makeDoc("audition-2", {
          ...savedAudition,
          project: "Hamlet",
          role: "Gertrude",
          analysisType: "brief",
          hasSides: false,
          hasBrief: true,
        }),
      ],
    });

    render(<SceneStudyEntry />);

    await waitFor(() => {
      expect(screen.getByText("Hamlet")).toBeInTheDocument();
    });
    expect(screen.getByText("Romeo and Juliet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Hamlet/i }));

    await waitFor(() => {
      expect(screen.getByTestId("wizard-props")).toHaveTextContent("sides:audition-2:resume");
    });
  });

  // Test 5 — a member only ever reaches their own records.
  it("reads only the signed-in member's collection", async () => {
    mockGetDocs.mockResolvedValue({ docs: [makeDoc("audition-1", savedAudition)] });

    render(<SceneStudyEntry />);

    await waitFor(() => {
      expect(mockGetDocs).toHaveBeenCalled();
    });

    expect(mockCollection).toHaveBeenCalledTimes(1);
    expect(mockCollection).toHaveBeenCalledWith({}, "users/user123_Actor/auditions");
    expect(mockCollection).not.toHaveBeenCalledWith({}, expect.stringContaining("user456"));
  });

  // Test 6 — the manual scene creation flow is preserved.
  it("keeps the manual scene flow when the member has no saved auditions", async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    render(<SceneStudyEntry />);

    await waitFor(() => {
      expect(mockGetDocs).toHaveBeenCalled();
    });

    expect(screen.queryByText("Continue a saved scene")).not.toBeInTheDocument();
    expect(screen.getByTestId("wizard-props")).toHaveTextContent("sides:none:blank");
  });

  it("keeps the manual scene flow when nobody is signed in", async () => {
    authModule.onAuthStateChanged.mockImplementation(
      (_auth: unknown, cb: (user: null) => void) => {
        cb(null);
        return jest.fn();
      }
    );

    render(<SceneStudyEntry />);

    await waitFor(() => {
      expect(screen.getByTestId("wizard-props")).toBeInTheDocument();
    });

    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(screen.queryByText("Continue a saved scene")).not.toBeInTheDocument();
  });

  it("surfaces a read failure without blocking the manual scene flow", async () => {
    mockGetDocs.mockRejectedValue(new Error("permission-denied"));

    render(<SceneStudyEntry />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByTestId("wizard-props")).toHaveTextContent("sides:none:blank");
  });
});
