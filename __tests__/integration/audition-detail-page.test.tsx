/** @jest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

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

jest.mock("@/lib/firebase", () => ({
  getDb: jest.fn(() => ({})),
  isFirebaseConfigured: jest.fn(() => true),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({
    currentUser: {
      uid: "test-uid",
      displayName: "Test Actor",
      getIdToken: jest.fn().mockResolvedValue("mock-token"),
    },
  })),
  onAuthStateChanged: jest.fn((_auth, cb) => {
    cb({ uid: "test-uid", displayName: "Test Actor" });
    return jest.fn();
  }),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_db, path) => ({ _doc: true, _path: typeof path === "string" ? path : _db })),
  getDoc: jest.fn(),
}));

jest.mock("react-to-print", () => ({
  useReactToPrint: jest.fn(() => jest.fn()),
}));

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
  useParams: jest.fn(() => ({ id: "mock-audition-id" })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

describe("AuditionDetailView regression (legacy single-analysis)", () => {
  const firestoreModule = require("firebase/firestore");
  const firebaseModule = require("@/lib/firebase");

  beforeEach(() => {
    jest.clearAllMocks();
    firebaseModule.getDb.mockReturnValue({});
  });

  it("renders legacy single-analysis audition using performanceMap when new schema fields are absent", async () => {
    const legacyDocData = {
      project: "Legacy Project",
      role: "Legacy Role",
      performanceMap: {
        intro: "Legacy intro text",
        sections: [
          { title: "Legacy Beat", items: ["Legacy tactic 1", "Legacy tactic 2"] },
        ],
        outro: "Legacy outro text",
      },
      analysisType: "sides",
    };

    firestoreModule.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => legacyDocData,
    });

    const Page = require("@/app/(interior)/auditions/[id]/page");
    const AuditionDetailView = Page.default || Page;
    render(<AuditionDetailView />);

    await waitFor(() => {
      expect(screen.getAllByText("Legacy Project")[0]).toBeInTheDocument();
    });
    expect(screen.getAllByText("Legacy Role")[0]).toBeInTheDocument();
  });

  it("renders sides-only analysis using sidesPerformanceMap when hasSides is true", async () => {
    const sidesOnlyData = {
      project: "Hamlet",
      role: "Ophelia",
      sidesPerformanceMap: {
        intro: "Ophelia sides intro",
        sections: [
          { title: "The Flowers Scene", items: ["There's rosemary", "That's for remembrance"] },
        ],
        outro: "Ophelia sides outro",
      },
      hasSides: true,
      hasBrief: false,
      analysisType: "sides",
    };

    firestoreModule.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => sidesOnlyData,
    });

    const Page = require("@/app/(interior)/auditions/[id]/page");
    const AuditionDetailView = Page.default || Page;
    render(<AuditionDetailView />);

    await waitFor(() => {
      expect(screen.getAllByText("Hamlet")[0]).toBeInTheDocument();
    });
    expect(screen.getAllByText("Ophelia")[0]).toBeInTheDocument();
  });

  it("renders brief-only analysis using briefPerformanceMap when hasBrief is true", async () => {
    const briefOnlyData = {
      project: "Hamlet",
      role: "Hamlet",
      briefPerformanceMap: {
        intro: "Hamlet character brief intro",
        sections: [{ title: "Psychology", items: ["Tragic hero", "Indecision"] }],
        outro: "Hamlet brief outro",
      },
      hasSides: false,
      hasBrief: true,
      analysisType: "brief",
    };

    firestoreModule.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => briefOnlyData,
    });

    const Page = require("@/app/(interior)/auditions/[id]/page");
    const AuditionDetailView = Page.default || Page;
    render(<AuditionDetailView />);

    await waitFor(() => {
      expect(screen.getAllByText("Hamlet")[0]).toBeInTheDocument();
    });
  });

  it("renders both Sides and Brief analyses when hasSides and hasBrief are both true", async () => {
    const dualData = {
      project: "Hamlet",
      role: "Ophelia",
      deadline: "2026-06-15T14:00",
      auditionTimezone: "America/Los_Angeles",
      sidesPerformanceMap: {
        intro: "Ophelia sides intro",
        sections: [
          { title: "Act 4 Scene 5", items: ["There's rosemary", "That's for remembrance"] },
        ],
        outro: "Ophelia sides outro",
      },
      briefPerformanceMap: {
        intro: "Ophelia brief intro",
        sections: [{ title: "Emotional Journey", items: ["Grief", "Betrayal", "Madness"] }],
        outro: "Ophelia brief outro",
      },
      hasSides: true,
      hasBrief: true,
      analysisType: "sides",
    };

    firestoreModule.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => dualData,
    });

    const Page = require("@/app/(interior)/auditions/[id]/page");
    const AuditionDetailView = Page.default || Page;
    render(<AuditionDetailView />);

    await waitFor(() => {
      expect(screen.getAllByText("Hamlet")[0]).toBeInTheDocument();
    });
    expect(screen.getAllByText("Ophelia")[0]).toBeInTheDocument();
    expect(screen.getByText("Sides Analysis")).toBeInTheDocument();
    expect(screen.getByText("Brief Analysis")).toBeInTheDocument();
  });

  it("renders Attach Brief button when only sides analysis exists", async () => {
    const sidesOnlyData = {
      project: "Hamlet",
      role: "Ophelia",
      sidesPerformanceMap: {
        intro: "Ophelia sides intro",
        sections: [{ title: "Scene", items: ["Line"] }],
        outro: "Outro",
      },
      hasSides: true,
      hasBrief: false,
      analysisType: "sides",
    };

    firestoreModule.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => sidesOnlyData,
    });

    const Page = require("@/app/(interior)/auditions/[id]/page");
    const AuditionDetailView = Page.default || Page;
    render(<AuditionDetailView />);

    await waitFor(() => {
      expect(screen.getByText(/attach brief/i)).toBeInTheDocument();
    });
  });

  it("renders Attach Sides button when only brief analysis exists", async () => {
    const briefOnlyData = {
      project: "Hamlet",
      role: "Hamlet",
      briefPerformanceMap: {
        intro: "Hamlet brief intro",
        sections: [{ title: "Psychology", items: ["Tragic hero"] }],
        outro: "Outro",
      },
      hasSides: false,
      hasBrief: true,
      analysisType: "brief",
    };

    firestoreModule.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => briefOnlyData,
    });

    const Page = require("@/app/(interior)/auditions/[id]/page");
    const AuditionDetailView = Page.default || Page;
    render(<AuditionDetailView />);

    await waitFor(() => {
      expect(screen.getByText(/attach sides/i)).toBeInTheDocument();
    });
  });

  it("renders the critical-facts block on a dual-map audition with criticalBriefFacts stored", async () => {
    const dualWithFacts = {
      project: "Hamlet",
      role: "Ophelia",
      sidesPerformanceMap: {
        intro: "Ophelia sides intro",
        sections: [{ title: "The Flowers", items: ["There's rosemary"] }],
        outro: "Ophelia sides outro",
      },
      briefPerformanceMap: {
        intro: "Ophelia brief intro",
        sections: [{ title: "Psychology", items: ["Betrayal"] }],
        outro: "Ophelia brief outro",
      },
      criticalBriefFacts: [
        { label: "Character Age", value: "Early 20s", importance: "critical" },
        { label: "Accent", value: "RP English", importance: "important" },
      ],
      hasSides: true,
      hasBrief: true,
      analysisType: "sides",
    };

    firestoreModule.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => dualWithFacts,
    });

    const Page = require("@/app/(interior)/auditions/[id]/page");
    const AuditionDetailView = Page.default || Page;
    render(<AuditionDetailView />);

    await waitFor(() => {
      expect(screen.getAllByText("Hamlet")[0]).toBeInTheDocument();
    });

    expect(
      screen.getByRole("region", { name: /critical facts from the casting brief/i })
    ).toBeInTheDocument();
    // Label/value pairs appear in both the screen block and the hidden print template
    expect(screen.getAllByText("Character Age:").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Early 20s/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Accent:").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/RP English/).length).toBeGreaterThanOrEqual(1);
  });

  it("does not render the critical-facts block when criticalBriefFacts is absent", async () => {
    const sidesOnlyNofacts = {
      project: "Hamlet",
      role: "Ophelia",
      sidesPerformanceMap: {
        intro: "Ophelia sides intro",
        sections: [{ title: "The Flowers", items: ["There's rosemary"] }],
        outro: "Ophelia sides outro",
      },
      hasSides: true,
      hasBrief: false,
      analysisType: "sides",
    };

    firestoreModule.getDoc.mockResolvedValue({
      exists: () => true,
      data: () => sidesOnlyNofacts,
    });

    const Page = require("@/app/(interior)/auditions/[id]/page");
    const AuditionDetailView = Page.default || Page;
    render(<AuditionDetailView />);

    await waitFor(() => {
      expect(screen.getAllByText("Hamlet")[0]).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("region", { name: /critical facts from the casting brief/i })
    ).not.toBeInTheDocument();
  });
});
