/**
 * @jest-environment jsdom
 */
"use client";

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { HeroSummary } from "../HeroSummary";

describe("HeroSummary Component", () => {
  const mockAttributes = [
    { id: "1", name: "Introspective", category: "Core Traits & Persona" },
    { id: "2", name: "Fear of Failure", category: "Values, Motivations & Emotional Reservoirs" },
    { id: "3", name: "Resilient Voice", category: "Communication & Vocal Dynamics" },
  ];

  it("renders completion percentage, attribute count, and key highlights", () => {
    render(
      <HeroSummary
        completion={0.75}
        totalAttributes={12}
        aiSummary="Actor possesses deep emotional resilience."
        attributes={mockAttributes}
      />
    );

    expect(screen.getByText("Actor Profile Snapshot")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("12 Traits")).toBeInTheDocument();
    expect(screen.getByText(/Introspective/i)).toBeInTheDocument();
  });

  it("collapses and expands full psychological synthesis when clicked", () => {
    render(
      <HeroSummary
        completion={0.5}
        totalAttributes={5}
        aiSummary="Full executive synthesis description text here."
        attributes={mockAttributes}
      />
    );

    const toggleBtn = screen.getByRole("button", { name: /read full psychological synthesis/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(screen.queryByText("Full executive synthesis description text here.")).not.toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByText("Full executive synthesis description text here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hide full psychological synthesis/i })).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.queryByText("Full executive synthesis description text here.")).not.toBeInTheDocument();
  });
});
