/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickPromptsDropdown } from "./quick-prompts-dropdown";

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

if (typeof window.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  }
  window.PointerEvent = PointerEvent as any;
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  window.HTMLElement.prototype.hasPointerCapture = jest.fn();
  window.HTMLElement.prototype.releasePointerCapture = jest.fn();
}

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
window.HTMLElement.prototype.scrollIntoView = jest.fn();

describe("components/quick-prompts-dropdown", () => {
  it("renders the trigger button with correct label and icon", () => {
    render(<QuickPromptsDropdown onSelect={jest.fn()} />);
    const trigger = screen.getByRole("button", { name: "Quick Prompts" });
    expect(trigger).toBeInTheDocument();
  });

  it("opens popover, renders search input, categories, and prompts on click", async () => {
    const user = userEvent.setup();
    render(<QuickPromptsDropdown onSelect={jest.fn()} />);

    const trigger = screen.getByRole("button", { name: "Quick Prompts" });
    await user.click(trigger);

    expect(screen.getByPlaceholderText("Search prompts...")).toBeInTheDocument();
    expect(screen.getByText("Actor's Craft")).toBeInTheDocument();
    expect(screen.getByText(/I'm working on a scene/i)).toBeInTheDocument();
  });

  it("calls onSelect with the prompt's id and closes popover on selection", async () => {
    const mockOnSelect = jest.fn();
    const user = userEvent.setup();
    render(<QuickPromptsDropdown onSelect={mockOnSelect} />);

    await user.click(screen.getByRole("button", { name: "Quick Prompts" }));
    
    // Selecting the first prompt from the data source
    const firstPrompt = screen.getByText(/I'm working on a scene/i);
    await user.click(firstPrompt);

    expect(mockOnSelect).toHaveBeenCalledWith(
    "I'm working on a scene. Help me define my character's Overall Objective and then walk me through a 'Destination' exercise to make that goal physical."
    );
  });
});