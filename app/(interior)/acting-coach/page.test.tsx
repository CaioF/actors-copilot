/** @jest-environment jsdom */

import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

// Mocks para o JSDOM não reclamar dos componentes do Radix UI/cmdk do QuickPromptsDropdown
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
window.HTMLElement.prototype.scrollIntoView = jest.fn();

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
const mockClearSession = jest.fn();

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
    expect(
      screen.getByText("Your coach is ready. What are we working on?")
    ).toBeInTheDocument();
  });

  it("renders the Acting Coach page header", () => {
    render(<ActingCoachPage />);
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

    expect(mockSendMessage).toHaveBeenCalledWith("How do I cold read?", undefined, null);
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
      clearSession: jest.fn(),
    });
    render(<ActingCoachPage />);
    expect(screen.queryByAltText("The Actors Copilot")).not.toBeInTheDocument();
  });

  it("renders QuickPromptsDropdown when messages is empty", () => {
    render(<ActingCoachPage />);
    expect(screen.getByRole("button", { name: "Quick Prompts" })).toBeInTheDocument();
  });

  it("does not render QuickPromptsDropdown when messages.length > 0", () => {
    (useActingCoach as jest.Mock).mockReturnValue({
      messages: [{ id: "1", role: "user", content: "Hello" }],
      isLoading: false,
      error: null,
      sendMessage: jest.fn(),
      clearSession: jest.fn(),
    });
    render(<ActingCoachPage />);
    expect(screen.queryByRole("button", { name: "Quick Prompts" })).not.toBeInTheDocument();
  });

  it("renders New Session button in the heading row at all times", () => {
    render(<ActingCoachPage />);
    expect(screen.getByText("New Session")).toBeInTheDocument();
  });

  it("clicking New Session calls clearSession", () => {
    render(<ActingCoachPage />);
    fireEvent.click(screen.getByText("New Session"));
    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  it("selecting a prompt from QuickPromptsDropdown triggers sendMessage", async () => {
    const user = userEvent.setup();
    render(<ActingCoachPage />);
    
    // Abre o dropdown
    await user.click(screen.getByRole("button", { name: "Quick Prompts" }));
    
    // Clica no primeiro prompt da lista
    const firstPrompt = screen.getByText(/I'm working on a scene/i);
    await user.click(firstPrompt);
    
    // Verifica se a página enviou o texto correto preenchido
    expect(mockSendMessage).toHaveBeenCalledWith(
      "I'm working on a scene. Help me define my character's Overall Objective and then walk me through a 'Destination' exercise to make that goal physical."
    );
  });

  it("auto-triggers sendMessage with audition context when auditionId URL param is present", () => {
    mockSearchParams.set("auditionId", "aud-123");
    mockSearchParams.set("project", "FOUNDATION");
    mockSearchParams.set("role", "TECHNICIAN");

    render(<ActingCoachPage />);

    expect(mockSendMessage).toHaveBeenCalledWith(
      "I want to work on my FOUNDATION audition as TECHNICIAN.",
      "aud-123"
    );
  });

  it("does not auto-trigger when auditionId URL param is absent", () => {
    render(<ActingCoachPage />);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});