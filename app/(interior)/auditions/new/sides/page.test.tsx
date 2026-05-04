/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockWizard = jest.fn(({ mode, auditionId }: { mode: string; auditionId?: string }) => (
  <div data-testid="wizard-props">{`${mode}:${auditionId ?? "none"}`}</div>
));

jest.mock("@/components/dashboard-header", () => ({
  DashboardHeader: ({ title }: { title: string }) => <div data-testid="dashboard-header">{title}</div>,
}));

jest.mock("@/components/auditions/audition-wizard", () => ({
  AuditionWizard: (props: { mode: string; auditionId?: string }) => mockWizard(props),
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

    expect(screen.getByTestId("dashboard-header")).toHaveTextContent("New character breakdown");
    expect(screen.getByTestId("wizard-props")).toHaveTextContent("sides:audition-123");
    expect(mockWizard).toHaveBeenCalledWith(expect.objectContaining({ mode: "sides", auditionId: "audition-123" }));
  });

  it("passes undefined auditionId when enrichAuditionId is missing", async () => {
    const page = await NewAuditionPage({
      searchParams: Promise.resolve({}),
    });

    render(page);

    expect(screen.getByTestId("wizard-props")).toHaveTextContent("sides:none");
    expect(mockWizard).toHaveBeenCalledWith(expect.objectContaining({ mode: "sides", auditionId: undefined }));
  });
});
