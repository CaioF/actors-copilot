/** @jest-environment jsdom */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { KeyboardEvent, ImgHTMLAttributes } from "react";
import type { ImageProps } from "next/image";

// Mock next/navigation
const mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(() => mockSearchParams),
}));

// Mock dependencies
jest.mock("@/components/dashboard-header", () => ({
  DashboardHeader: ({ title }: { title: string }) => <div data-testid="dashboard-header">{title}</div>,
}));

interface MockChatInputProps {
  onSend: (content: string) => void;
  placeholder?: string;
  isLoading?: boolean;
}

jest.mock("@/components/chat-input", () => ({
  ChatInput: ({ onSend, placeholder, isLoading }: MockChatInputProps) => (
    <input
      data-testid="chat-input"
      placeholder={placeholder}
      disabled={isLoading}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        // Using currentTarget ensures type safety without casting
        const target = e.currentTarget;
        if (e.key === "Enter" && target.value) {
          onSend(target.value);
          target.value = "";
        }
      }}
    />
  ),
}));

interface MockQuickPromptsDropdownProps {
  onSelect: (prompt: string) => void;
}

jest.mock("@/components/quick-prompts-dropdown", () => ({
  QuickPromptsDropdown: ({ onSelect }: MockQuickPromptsDropdownProps) => (
    <button
      data-testid="quick-prompts-dropdown"
      onClick={() => onSelect("What are my strengths as an actor?")}
    >
      Quick Prompts
    </button>
  ),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  // Using ImageProps for strong typing. Destructuring Next.js custom props
  // like `priority` prevents React console warnings on native img elements.
  default: function MockImage({ src, alt, priority, ...rest }: ImageProps) {
    return (
      <img
        src={src as string}
        alt={alt}
        {...(rest as ImgHTMLAttributes<HTMLImageElement>)}
      />
    );
  },
}));

const mockSendMessage = jest.fn();
const mockStartNewSession = jest.fn().mockResolvedValue(undefined);
const mockClearSessionFocus = jest.fn().mockResolvedValue(undefined);

jest.mock("@/hooks/use-acting-coach", () => ({
  useActingCoach: jest.fn(),
}));

jest.mock("@/lib/acting-coach/render-markdown", () => ({
  renderMarkdown: (s: string) => s,
}));

import ActingCoachPage from "./page";
import { useActingCoach } from "@/hooks/use-acting-coach";

describe("ActingCoachPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.delete("auditionId");
    mockSearchParams.delete("project");
    mockSearchParams.delete("role");

    (useActingCoach as jest.Mock).mockReturnValue({
      messages: [],
      isLoading: false,
      sendMessage: mockSendMessage,
      startNewSession: mockStartNewSession,
      clearSessionFocus: mockClearSessionFocus,
      session: { title: "Session 1", sessionFocus: null },
    });
  });

  describe("Layout and Header", () => {
    it("renders the dashboard header with correct title format", () => {
      render(<ActingCoachPage />);
      expect(screen.getByTestId("dashboard-header")).toHaveTextContent("Acting Coach — Session 1");
    });

    it("renders the header without session title when session title is null", () => {
      (useActingCoach as jest.Mock).mockReturnValue({
        messages: [],
        isLoading: false,
        sendMessage: mockSendMessage,
        startNewSession: mockStartNewSession,
        clearSessionFocus: mockClearSessionFocus,
        session: { title: null, sessionFocus: null },
      });

      render(<ActingCoachPage />);
      expect(screen.getByTestId("dashboard-header")).toHaveTextContent("Acting Coach");
    });

    it("renders ChatInput with custom placeholder", () => {
      render(<ActingCoachPage />);
      expect(screen.getByTestId("chat-input")).toHaveAttribute("placeholder", "Talk to your coach...");
    });
  });

  describe("Empty State", () => {
    it("renders empty state with logo and description when no messages", () => {
      render(<ActingCoachPage />);
      expect(screen.getByText("Your coach is ready.")).toBeInTheDocument();
      expect(screen.getByText(/Ask anything about your character/)).toBeInTheDocument();
    });

    it("renders QuickPromptsDropdown when messages are empty", () => {
      render(<ActingCoachPage />);
      expect(screen.getByTestId("quick-prompts-dropdown")).toBeInTheDocument();
    });

    it("still renders QuickPromptsDropdown when messages exist (now floats over chat)", () => {
      (useActingCoach as jest.Mock).mockReturnValue({
        messages: [{ id: "1", role: "user" as const, content: "Hello" }],
        isLoading: false,
        sendMessage: mockSendMessage,
        startNewSession: mockStartNewSession,
        clearSessionFocus: mockClearSessionFocus,
        session: { title: "Session 1", sessionFocus: null },
      });

      render(<ActingCoachPage />);
      expect(screen.getByTestId("quick-prompts-dropdown")).toBeInTheDocument();
    });
  });

  describe("New Session Button", () => {
    it("renders New Session button", () => {
      render(<ActingCoachPage />);
      expect(screen.getByRole("button", { name: /New Session/i })).toBeInTheDocument();
    });

    it("calls startNewSession when New Session button is clicked", () => {
      render(<ActingCoachPage />);
      fireEvent.click(screen.getByRole("button", { name: /New Session/i }));
      expect(mockStartNewSession).toHaveBeenCalledTimes(1);
    });
  });

  describe("Message Display", () => {
    it("renders user and assistant messages correctly", () => {
      (useActingCoach as jest.Mock).mockReturnValue({
        messages: [
          { id: "1", role: "user" as const, content: "How do I cold read?" },
          { id: "2", role: "assistant" as const, content: "Cold reading is a technique..." },
        ],
        isLoading: false,
        sendMessage: mockSendMessage,
        startNewSession: mockStartNewSession,
        clearSessionFocus: mockClearSessionFocus,
        session: { title: "Session 1", sessionFocus: null },
      });

      render(<ActingCoachPage />);
      expect(screen.getByText("How do I cold read?")).toBeInTheDocument();
      expect(screen.getByText("Cold reading is a technique...")).toBeInTheDocument();
    });

    it("does not render empty state when messages exist", () => {
      (useActingCoach as jest.Mock).mockReturnValue({
        messages: [{ id: "1", role: "user" as const, content: "Test message" }],
        isLoading: false,
        sendMessage: mockSendMessage,
        startNewSession: mockStartNewSession,
        clearSessionFocus: mockClearSessionFocus,
        session: { title: "Session 1", sessionFocus: null },
      });

      render(<ActingCoachPage />);
      expect(screen.queryByText("Your coach is ready.")).not.toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("renders loading indicator when isLoading is true", () => {
      (useActingCoach as jest.Mock).mockReturnValue({
        messages: [{ id: "1", role: "user" as const, content: "Test" }],
        isLoading: true,
        sendMessage: mockSendMessage,
        startNewSession: mockStartNewSession,
        clearSessionFocus: mockClearSessionFocus,
        session: { title: "Session 1", sessionFocus: null },
      });

      render(<ActingCoachPage />);
      const animatedDots = document.querySelectorAll(".animate-bounce");
      expect(animatedDots.length).toBeGreaterThan(0);
    });

    it("disables ChatInput when isLoading is true", () => {
      (useActingCoach as jest.Mock).mockReturnValue({
        messages: [],
        isLoading: true,
        sendMessage: mockSendMessage,
        startNewSession: mockStartNewSession,
        clearSessionFocus: mockClearSessionFocus,
        session: { title: "Session 1", sessionFocus: null },
      });

      render(<ActingCoachPage />);
      expect(screen.getByTestId("chat-input")).toBeDisabled();
    });
  });

  describe("Search Params and Auto-Trigger", () => {
    it("auto-triggers sendMessage when audition search params are present", async () => {
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

    it("does not auto-trigger message if auditionId is missing", async () => {
      mockSearchParams.set("project", "FOUNDATION");
      mockSearchParams.set("role", "TECHNICIAN");

      render(<ActingCoachPage />);

      await waitFor(() => {
        expect(mockSendMessage).not.toHaveBeenCalled();
      });
    });

    it("does not trigger message multiple times on re-render", async () => {
      mockSearchParams.set("auditionId", "aud-123");
      mockSearchParams.set("project", "FOUNDATION");
      mockSearchParams.set("role", "TECHNICIAN");

      const { rerender } = render(<ActingCoachPage />);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledTimes(1);
      });

      rerender(<ActingCoachPage />);

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe("Message Input", () => {
    it("sends message with correct payload when ChatInput is submitted", async () => {
      render(<ActingCoachPage />);
      const input = screen.getByTestId("chat-input") as HTMLInputElement;

      fireEvent.change(input, { target: { value: "How do I prepare for an audition?" } });
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

      expect(mockSendMessage).toHaveBeenCalledWith(
        "How do I prepare for an audition?",
        undefined,
        undefined
      );
    });
  });
});