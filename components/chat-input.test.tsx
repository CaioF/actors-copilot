/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ChatInput } from "./chat-input";

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({
    currentUser: { getIdToken: jest.fn(() => Promise.resolve("mock-token")) },
  })),
}));

const mockOnSend = jest.fn();
beforeEach(() => { mockOnSend.mockClear(); });

describe("ChatInput placeholder", () => {
  it("renders default placeholder when no prop is passed", () => {
    render(<ChatInput onSend={mockOnSend} isLoading={false} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("placeholder", "Ask me anything...");
  });

  it("renders custom placeholder when prop is provided", () => {
    render(
      <ChatInput onSend={mockOnSend} isLoading={false} placeholder="Talk to your coach..." />
    );
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("placeholder", "Talk to your coach...");
  });
});
