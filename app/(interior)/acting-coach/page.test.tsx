/** @jest-environment jsdom */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/lib/firebase", () => ({
  getDb: jest.fn(),
  isFirebaseConfigured: jest.fn(() => false),
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

const mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
  usePathname: jest.fn(() => "/acting-coach"),
  useSearchParams: jest.fn(() => mockSearchParams),
}));

const mockSendMessage = jest.fn();
const mockStartNewSession = jest.fn().mockResolvedValue(undefined);

jest.mock("@/hooks/use-acting-coach", () => ({
  useActingCoach: jest.fn(),
}));

import ActingCoachPage from "./page";
import { useActingCoach } from "@/hooks/use-acting-coach";

describe("ActingCoachPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.delete("auditionId");
    mockSearchParams.delete("project");
    mockSearchParams.delete("role");
    mockSendMessage.mockImplementation(() => Promise.resolve());
    mockStartNewSession.mockClear();
    mockSendMessage.mockImplementation(() => Promise.resolve());
    mockStartNewSession.mockResolvedValue(undefined);
    (useActingCoach as jest.Mock).mockReturnValue({
      messages: [],
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      startNewSession: mockStartNewSession,
      session: { title: null, linkedAuditionId: null, sessionFocus: null, stepIndex: 0, mode: null, phase: null },
    });
  });

  it("renders ChatInput with custom placeholder", () => {
    render(<ActingCoachPage />);
    expect(screen.getByPlaceholderText("Talk to your coach...")).toBeInTheDocument();
  });

  it("renders the subtitle in heading section", () => {
    render(<ActingCoachPage />);
    expect(screen.getByText("Session 1")).toBeInTheDocument();
  });

  it("renders the Acting Coach page header", () => {
    render(<ActingCoachPage />);
    // Both the DashboardHeader and the heading section render "Acting Coach"
    const matches = screen.getAllByText("Acting Coach");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("calls sendMessage when user submits a message", async () => {
    render(<ActingCoachPage />);

    const input = screen.getByPlaceholderText("Talk to your coach...");
    fireEvent.change(input, { target: { value: "How do I cold read?" } });

    const sendButton = document.querySelector(
      "button[aria-label='Send message']"
    ) as HTMLButtonElement;
    if (sendButton) {
      fireEvent.click(sendButton);
    }

    expect(mockSendMessage).toHaveBeenCalledWith("How do I cold read?");
  });

  it("renders empty-state center block with logo, heading, and description", () => {
    render(<ActingCoachPage />);
    expect(screen.getByAltText("The Actors Copilot")).toBeInTheDocument();
    expect(screen.getByText("Your coach is ready.")).toBeInTheDocument();
    expect(
      screen.getByText(/ask anything about your character/i)
    ).toBeInTheDocument();
  });

  it("does not render the empty-state center block when messages exist", () => {
    (useActingCoach as jest.Mock).mockReturnValue({
      messages: [{ id: "1", role: "user", content: "Hello" }],
      isLoading: false,
      error: null,
      sendMessage: jest.fn(),
      startNewSession: jest.fn(),
      session: null,
    });
    render(<ActingCoachPage />);
    expect(screen.queryByAltText("The Actors Copilot")).not.toBeInTheDocument();
  });

  it("renders suggestion chips when messages is empty", () => {
    render(<ActingCoachPage />);
    expect(screen.getByText("Help me deepen my objective")).toBeInTheDocument();
    expect(screen.getByText("I just got a redirect - what do I do?")).toBeInTheDocument();
    expect(screen.getByText("I'm spiraling before an audition")).toBeInTheDocument();
    expect(screen.getByText("Apply this to my DNA")).toBeInTheDocument();
  });

  it("does not render suggestion chips when messages.length > 0", () => {
    (useActingCoach as jest.Mock).mockReturnValue({
      messages: [{ id: "1", role: "user", content: "Hello" }],
      isLoading: false,
      error: null,
      sendMessage: jest.fn(),
      startNewSession: jest.fn(),
      session: null,
    });
    render(<ActingCoachPage />);
    expect(screen.queryByText("Help me deepen my objective")).not.toBeInTheDocument();
  });

  it("renders New Session button in the heading row at all times", () => {
    render(<ActingCoachPage />);
    expect(screen.getByText("New Session")).toBeInTheDocument();
  });

  it("clicking New Session calls startNewSession", () => {
    render(<ActingCoachPage />);
    fireEvent.click(screen.getByText("New Session"));
    expect(mockStartNewSession).toHaveBeenCalledTimes(1);
  });

  it("clicking a suggestion chip triggers sendMessage with the chip prompt", () => {
    render(<ActingCoachPage />);
    fireEvent.click(screen.getByText("Help me deepen my objective"));
    expect(mockSendMessage).toHaveBeenCalledWith("Help me deepen my objective");
  });

  it("auto-triggers sendMessage with audition context when auditionId URL param is present", async () => {
    mockSearchParams.set("auditionId", "aud-123");
    mockSearchParams.set("project", "FOUNDATION");
    mockSearchParams.set("role", "TECHNICIAN");

    render(<ActingCoachPage />);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        "I want to work on my FOUNDATION audition as TECHNICIAN.",
        "aud-123"
      );
    });
  });

  it("does not auto-trigger when auditionId URL param is absent", () => {
    render(<ActingCoachPage />);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
