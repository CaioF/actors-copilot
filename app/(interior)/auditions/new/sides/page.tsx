import { DashboardHeader } from "@/components/dashboard-header";
import { AuditionWizard } from "@/components/auditions/audition-wizard";
import { SceneStudyEntry } from "@/components/auditions/scene-study-entry";

interface PageProps {
  searchParams?: Promise<{ enrichAuditionId?: string }>;
}

/**
 * Page for creating a new character breakdown.
 *
 * Two entry points land here:
 * - Direct Scene Study (sidebar / dashboard): shows the member's saved auditions
 *   so an existing scene can be picked up again.
 * - Attach Sides / Attach Brief (`?enrichAuditionId=`): opens the saved audition
 *   in enrichment mode, exactly as before.
 * @returns The rendered new audition page with wizard
 */
export default async function NewAuditionPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const enrichAuditionId = params.enrichAuditionId;

  return (
    <main className="flex flex-1 flex-col h-full bg-background text-foreground transition-colors">
      <DashboardHeader title="New Character Breakdown" />

      {/* Container rolável para o Wizard */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        {enrichAuditionId ? (
          <AuditionWizard mode="sides" auditionId={enrichAuditionId} />
        ) : (
          <SceneStudyEntry />
        )}
      </div>
    </main>
  );
}
