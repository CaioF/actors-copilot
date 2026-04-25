/** @jest-environment jsdom */

import { render, screen, fireEvent } from "@testing-library/react";
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

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
  usePathname: jest.fn(() => "/acting-coach"),
}));

const mockSendMessage = jest.fn();
const mockClearSession = jest.fn();

jest.mock("@/hooks/use-acting-coach", () => ({
  useActingCoach: jest.fn(),
}));

import ActingCoachPage from "./page";
import { useActingCoach } from "@/hooks/use-acting-coach";

describe("ActingCoachPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMessage.mockImplementation(() => Promise.resolve());
    mockClearSession.mockImplementation(() => {});
    (useActingCoach as jest.Mock).mockReturnValue({
      messages: [],
      isLoading: false,
      error: null,
      sendMessage: mockSendMessage,
      clearSession: mockClearSession,
    });
  });

  it("renders ChatInput with custom placeholder", () => {
    render(<ActingCoachPage />);
    expect(screen.getByPlaceholderText("Talk to your coach...")).toBeInTheDocument();
  });

  it("renders the subtitle in heading section", () => {
    render(<ActingCoachPage />);
    expect(screen.getByText("Your coach is ready. What are we working on?")).toBeInTheDocument();
  });

  it("renders the Acting Coach page header", () => {
    render(<ActingCoachPage />);
    expect(screen.getByText("Acting Coach")).toBeInTheDocument();
  });

  it("calls sendMessage when user submits a message", async () => {
    render(<ActingCoachPage />);

    const input = screen.getByPlaceholderText("Talk to your coach...");
    fireEvent.change(input, { target: { value: "How do I cold read?" } });

    const sendButton = document.querySelector("button[aria-label='Send message']") as HTMLButtonElement;
    if (sendButton) {
      fireEvent.click(sendButton);
    }

    expect(mockSendMessage).toHaveBeenCalledWith("How do I cold read?");
  });

  it("renders DashboardFooter with privacy items", () => {
    render(<ActingCoachPage />);
    expect(screen.getByText("NDA Safe")).toBeInTheDocument();
    expect(screen.getByText("Delete Anytime")).toBeInTheDocument();
    expect(screen.getByText("Private By Default")).toBeInTheDocument();
  });

  it("renders welcome bubble with coach greeting when messages is empty", () => {
    render(<ActingCoachPage />);
    expect(screen.getByText(/welcome to your acting coach/i)).toBeInTheDocument();
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
      clearSession: jest.fn(),
    });
    render(<ActingCoachPage />);
    expect(screen.queryByText("Help me deepen my objective")).not.toBeInTheDocument();
  });

  it("renders New Session button when messages.length > 0", () => {
    (useActingCoach as jest.Mock).mockReturnValue({
      messages: [{ id: "1", role: "user", content: "Hello" }],
      isLoading: false,
      error: null,
      sendMessage: jest.fn(),
      clearSession: jest.fn(),
    });
    render(<ActingCoachPage />);
    expect(screen.getByText("New Session")).toBeInTheDocument();
  });

  it("clicking New Session calls clearSession", () => {
    const clearSessionMock = jest.fn();
    (useActingCoach as jest.Mock).mockReturnValue({
      messages: [{ id: "1", role: "user", content: "Hello" }],
      isLoading: false,
      error: null,
      sendMessage: jest.fn(),
      clearSession: clearSessionMock,
    });
    render(<ActingCoachPage />);
    fireEvent.click(screen.getByText("New Session"));
    expect(clearSessionMock).toHaveBeenCalledTimes(1);
  });

  it("clicking a suggestion chip triggers sendMessage with the chip prompt", () => {
    render(<ActingCoachPage />);
    fireEvent.click(screen.getByText("Help me deepen my objective"));
    expect(mockSendMessage).toHaveBeenCalledWith("Help me deepen my objective");
  });
});
