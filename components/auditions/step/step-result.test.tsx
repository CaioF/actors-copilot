/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { ReactNode } from "react";
import { StepResultSides } from "./step-result";

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

class IntersectionObserverMock {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
  takeRecords = jest.fn(() => []);
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: IntersectionObserverMock,
});

const minimalData = {
  intro: "Test intro",
  sections: [{ title: "Objective", items: ["Item one"] }],
  outro: "Test outro",
};

describe("StepResultSides — Critical Brief Facts block", () => {
  it("renders the highlighted critical-facts block when criticalBriefFacts is present", () => {
    render(
      <StepResultSides
        data={{
          ...minimalData,
          criticalBriefFacts: [
            { label: "Character Age", value: "Late 30s", importance: "critical" },
            { label: "Accent", value: "Northern English", importance: "important" },
          ],
        }}
      />
    );

    expect(screen.getByRole("region", { name: /critical facts from the casting brief/i })).toBeInTheDocument();
    expect(screen.getByText("Character Age:")).toBeInTheDocument();
    expect(screen.getByText(/Late 30s/)).toBeInTheDocument();
    expect(screen.getByText("Accent:")).toBeInTheDocument();
    expect(screen.getByText(/Northern English/)).toBeInTheDocument();
    // Importance badge present for both
    expect(screen.getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("important")).toBeInTheDocument();
  });

  it("does not render the critical-facts block when criticalBriefFacts is absent", () => {
    render(<StepResultSides data={minimalData} />);

    expect(
      screen.queryByRole("region", { name: /critical facts from the casting brief/i })
    ).not.toBeInTheDocument();
  });

  it("does not render the critical-facts block when criticalBriefFacts is empty", () => {
    render(
      <StepResultSides
        data={{ ...minimalData, criticalBriefFacts: [] }}
      />
    );

    expect(
      screen.queryByRole("region", { name: /critical facts from the casting brief/i })
    ).not.toBeInTheDocument();
  });

  it("renders the block above the intro content, not after it", () => {
    const { container } = render(
      <StepResultSides
        data={{
          ...minimalData,
          criticalBriefFacts: [
            { label: "Director Style", value: "Method", importance: "critical" },
          ],
        }}
      />
    );

    const leftColumn = container.querySelector(".space-y-6");
    const children = Array.from(leftColumn?.children ?? []);
    const factsIdx = children.findIndex((el) =>
      el.getAttribute("role") === "region"
    );
    // intro renders as a div without role, so it should come after the facts block
    expect(factsIdx).toBeGreaterThanOrEqual(0);
    expect(factsIdx).toBe(1); // first child in the left column
  });
});
