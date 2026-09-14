/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { ProfileLivePreview } from "./profile-live-preview";
import { ActorProfile, defaultActorProfile } from "@/lib/profile-types";

function renderPreview(values: Partial<ActorProfile>) {
  function Wrapper() {
    const methods = useForm<ActorProfile>({
      defaultValues: { ...defaultActorProfile, ...values },
    });

    return (
      <FormProvider {...methods}>
        <ProfileLivePreview />
      </FormProvider>
    );
  }

  return render(<Wrapper />);
}

describe("ProfileLivePreview", () => {
  it("falls back to legacy agencyName when agents contain no non-empty names", () => {
    renderPreview({
      fullName: "Test Actor",
      agencyName: "Legacy Agency",
      agents: [
        {
          agencyName: "",
          agencyEmail: "agent@example.com",
          agencyWebsite: "",
          agencyPhone: "",
        },
      ],
    });

    expect(screen.getByText("Rep: Legacy Agency")).toBeTruthy();
  });
});
