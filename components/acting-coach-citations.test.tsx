/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ActingCoachCitations } from "./acting-coach-citations";
import type { CoachCitation } from "@/lib/acting-coach/contracts";

describe("ActingCoachCitations", () => {
  it("renders nothing when citations array is empty", () => {
    const { container } = render(<ActingCoachCitations citations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when citations is undefined", () => {
    const { container } = render(
      // @ts-expect-error - testing undefined handling
      <ActingCoachCitations citations={undefined} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders citation cards with source attribution and excerpt text", () => {
    const citations: CoachCitation[] = [
      {
        citationNumber: 1,
        sourceBook: "Audition Success",
        excerptText: "Know your material inside out.",
      },
      {
        citationNumber: 2,
        sourceBook: "The Actor's Art",
        excerptText: "Practice with focus and intention.",
      },
    ];

    render(<ActingCoachCitations citations={citations} />);

    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("Audition Success")).toBeInTheDocument();
    expect(
      screen.getByText(/know your material inside out/i)
    ).toBeInTheDocument();
    expect(screen.getByText("The Actor's Art")).toBeInTheDocument();
    expect(
      screen.getByText(/practice with focus and intention/i)
    ).toBeInTheDocument();
  });

  it("renders correct citation numbers", () => {
    const citations: CoachCitation[] = [
      {
        citationNumber: 1,
        sourceBook: "First Book",
        excerptText: "First excerpt.",
      },
      {
        citationNumber: 2,
        sourceBook: "Second Book",
        excerptText: "Second excerpt.",
      },
      {
        citationNumber: 3,
        sourceBook: "Third Book",
        excerptText: "Third excerpt.",
      },
    ];

    render(<ActingCoachCitations citations={citations} />);

    const numbers = screen.getAllByText(/\d/);
    expect(numbers.length).toBeGreaterThanOrEqual(3);
  });

  it("renders single citation correctly", () => {
    const citations: CoachCitation[] = [
      {
        citationNumber: 1,
        sourceBook: "Acting Techniques",
        excerptText: "Some technique description.",
      },
    ];

    render(<ActingCoachCitations citations={citations} />);

    expect(screen.getByText("Acting Techniques")).toBeInTheDocument();
    expect(
      screen.getByText(/some technique description/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Sources")).toBeInTheDocument();
  });
});