/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockWizard = jest.fn(({ mode, auditionId }: { mode: string; auditionId?: string }) => (
  <div data-testid="wizard-props">{`${mode}:${auditionId ?? "none"}`}</div>
));

const mockSceneStudyEntry = jest.fn(() => <div data-testid="scene-study-entry" />);

jest.mock("@/components/dashboard-header", () => ({
  DashboardHeader: ({ title }: { title: string }) => <div data-testid="dashboard-header">{title}</div>,
}));

jest.mock("@/components/auditions/audition-wizard", () => ({
  AuditionWizard: (props: { mode: string; auditionId?: string }) => mockWizard(props),
}));

jest.mock("@/components/auditions/scene-study-entry", () => ({
  SceneStudyEntry: () => mockSceneStudyEntry(),
}));

import NewAuditionPage from "./page";

describe("new sides page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes enrichAuditionId from searchParams to AuditionWizard", async () => {
    const page = await NewAuditionPage({
      searchParams: Promise.resolve({ enrichAuditionId: "audition-123" }),
    });

    render(page);

    expect(screen.getByTestId("dashboard-header")).toHaveTextContent("New Character Breakdown");
    expect(screen.getByTestId("wizard-props")).toHaveTextContent("sides:audition-123");
    expect(mockWizard).toHaveBeenCalledWith(expect.objectContaining({ mode: "sides", auditionId: "audition-123" }));
    // The Attach Sides flow must not go through the Scene Study entry point.
    expect(mockSceneStudyEntry).not.toHaveBeenCalled();
  });

  it("renders the Scene Study entry when enrichAuditionId is missing", async () => {
    const page = await NewAuditionPage({
      searchParams: Promise.resolve({}),
    });

    render(page);

    expect(screen.getByTestId("scene-study-entry")).toBeInTheDocument();
    expect(mockSceneStudyEntry).toHaveBeenCalledTimes(1);
    expect(mockWizard).not.toHaveBeenCalled();
  });
});
