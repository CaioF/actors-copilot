/** @jest-environment jsdom */

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CoachSuggestionChips, SUGGESTIONS } from "./coach-suggestion-chips";

describe("CoachSuggestionChips", () => {
  it("renders all 4 suggestion chips with correct labels", () => {
    render(<CoachSuggestionChips onSelect={jest.fn()} />);

    SUGGESTIONS.forEach((suggestion) => {
      expect(screen.getByRole("button", { name: suggestion.label })).toBeInTheDocument();
    });
  });

  it("calls onSelect with the chip prompt text when clicked", () => {
    const onSelect = jest.fn();
    render(<CoachSuggestionChips onSelect={onSelect} />);

    SUGGESTIONS.forEach((suggestion) => {
      const button = screen.getByRole("button", { name: suggestion.label });
      button.click();
      expect(onSelect).toHaveBeenCalledWith(suggestion.prompt);
    });
    expect(onSelect).toHaveBeenCalledTimes(SUGGESTIONS.length);
  });

  it("returns null when onSelect is undefined", () => {
    const { container } = render(<CoachSuggestionChips onSelect={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("chips are focusable via Tab and activatable via Enter", () => {
    const onSelect = jest.fn();
    render(<CoachSuggestionChips onSelect={onSelect} />);

    const firstChip = screen.getByRole("button", { name: SUGGESTIONS[0].label });
    firstChip.focus();
    expect(firstChip).toHaveFocus();

    fireEvent.keyDown(firstChip, { key: "Enter", code: "Enter", keyCode: 13, which: 13 });
    fireEvent.click(firstChip);
    expect(onSelect).toHaveBeenCalledWith(SUGGESTIONS[0].prompt);
  });
});
