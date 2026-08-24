/**
 * @jest-environment jsdom
 */
"use client";

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BreakCheckInModal } from "../break-check-in-modal";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("BreakCheckInModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not render modal content when isOpen is false", () => {
    render(<BreakCheckInModal isOpen={false} onKeepGoing={jest.fn()} />);
    expect(screen.queryByText("Time for a breather?")).not.toBeInTheDocument();
  });

  it("renders modal content and action buttons when isOpen is true", () => {
    render(<BreakCheckInModal isOpen={true} onKeepGoing={jest.fn()} />);

    expect(screen.getByText("Time for a breather?")).toBeInTheDocument();
    expect(screen.getByText(/deep, focused work for the last 15 minutes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /keep going/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /take a break/i })).toBeInTheDocument();
  });

  it("calls onKeepGoing when 'Keep Going' button is clicked", () => {
    const handleKeepGoing = jest.fn();
    render(<BreakCheckInModal isOpen={true} onKeepGoing={handleKeepGoing} />);

    fireEvent.click(screen.getByRole("button", { name: /keep going/i }));
    expect(handleKeepGoing).toHaveBeenCalledTimes(1);
  });

  it("navigates to /dashboard when 'Take a Break' is clicked", () => {
    const handleKeepGoing = jest.fn();
    render(<BreakCheckInModal isOpen={true} onKeepGoing={handleKeepGoing} />);

    fireEvent.click(screen.getByRole("button", { name: /take a break/i }));
    expect(handleKeepGoing).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("calls custom onTakeBreak callback if provided", () => {
    const handleKeepGoing = jest.fn();
    const handleTakeBreak = jest.fn();
    render(
      <BreakCheckInModal
        isOpen={true}
        onKeepGoing={handleKeepGoing}
        onTakeBreak={handleTakeBreak}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /take a break/i }));
    expect(handleKeepGoing).toHaveBeenCalledTimes(1);
    expect(handleTakeBreak).toHaveBeenCalledTimes(1);
  });
});
