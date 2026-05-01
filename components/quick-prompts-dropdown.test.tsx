/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickPromptsDropdown } from "./quick-prompts-dropdown";

beforeAll(() => {
  Element.prototype.getBoundingClientRect = jest.fn(() => ({
    width: 120, height: 120, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON: () => {}
  }));

  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  if (typeof window.PointerEvent === 'undefined') {
    class PointerEvent extends MouseEvent {
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
      }
    }
    window.PointerEvent = PointerEvent as any;
  }
  
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  window.HTMLElement.prototype.hasPointerCapture = jest.fn();
  window.HTMLElement.prototype.releasePointerCapture = jest.fn();
});

describe("components/quick-prompts-dropdown", () => {
  it("renders the trigger button with correct label and icon", () => {
    render(<QuickPromptsDropdown onSelect={jest.fn()} />);
    const trigger = screen.getByRole("button", { name: "Quick Prompts" });
    expect(trigger).toBeInTheDocument();
  });

  it("opens popover, renders search input, categories, and prompts on click", async () => {

    render(<QuickPromptsDropdown onSelect={jest.fn()} />);

    const trigger = screen.getByRole("button", { name: "Quick Prompts" });
    
    fireEvent.click(trigger);

    expect(await screen.findByPlaceholderText("Search prompts...")).toBeInTheDocument();
    
    expect(screen.getByText("Actor's Craft")).toBeInTheDocument();
    expect(screen.getByText(/I'm working on a scene/i)).toBeInTheDocument();
  });

  it("calls onSelect with the prompt's id and closes popover on selection", async () => {
    const mockOnSelect = jest.fn();
    // 1. Remova o const user = userEvent.setup();
    render(<QuickPromptsDropdown onSelect={mockOnSelect} />);

    const trigger = screen.getByRole("button", { name: "Quick Prompts" });
    fireEvent.click(trigger); // <-- AQUI
    
    const firstPrompt = await screen.findByText(/I'm working on a scene/i);
    fireEvent.click(firstPrompt); // <-- E AQUI

    expect(mockOnSelect).toHaveBeenCalledWith(
      "I'm working on a scene. Help me define my character's Overall Objective and then walk me through a 'Destination' exercise to make that goal physical."
    );
  });
});