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

jest.mock("@/hooks/use-acting-coach", () => ({
  useActingCoach: () => ({
    messages: [],
    isLoading: false,
    error: null,
    sendMessage: mockSendMessage,
  }),
}));

import ActingCoachPage from "./page";

describe("ActingCoachPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMessage.mockImplementation(() => Promise.resolve());
  });

  it("renders ChatInput with placeholder", () => {
    render(<ActingCoachPage />);
    expect(screen.getByPlaceholderText(/ask me anything/i)).toBeInTheDocument();
  });

  it("renders the coach welcome content when no messages", () => {
    render(<ActingCoachPage />);
    expect(screen.getByText("Your Personal Acting Coach")).toBeInTheDocument();
    expect(
      screen.getByText(/ask me anything about acting techniques/i)
    ).toBeInTheDocument();
  });

  it("renders the Acting Coach page header", () => {
    render(<ActingCoachPage />);
    expect(screen.getByText("Acting Coach")).toBeInTheDocument();
  });

  it("calls sendMessage when user submits a message", async () => {
    render(<ActingCoachPage />);

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: "How do I cold read?" } });

    const sendButton = document.querySelector("button[aria-label='Send message']") as HTMLButtonElement;
    if (sendButton) {
      fireEvent.click(sendButton);
    }

    expect(mockSendMessage).toHaveBeenCalledWith("How do I cold read?");
  });

  it("renders the footer text", () => {
    render(<ActingCoachPage />);
    expect(screen.getByText(/responses are grounded in our acting library/i)).toBeInTheDocument();
  });
});