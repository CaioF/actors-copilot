import { DashboardHeader } from "@/components/dashboard-header";
import { AuditionWizard } from "@/components/auditions/audition-wizard";

/**
 * Page for creating a new character breakdown.
 * Renders the AuditionWizard component for guided audition creation.
 * @returns The rendered new audition page with wizard
 */
export default function NewAuditionPage() {
  return (
    <main className="flex flex-1 flex-col h-full bg-[#F5F0E8]">
      <DashboardHeader title="New character breakdown" />
      
      {/* Container rolável para o Wizard */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <AuditionWizard mode="sides" />
      </div>
    </main>
  );
}