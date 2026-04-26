import type { CoachCitation } from "@/lib/acting-coach/contracts";

interface ActingCoachCitationsProps {
  citations: CoachCitation[];
}

export function ActingCoachCitations({ citations }: ActingCoachCitationsProps) {
  if (!citations || citations.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#6B6B6B]">
        Sources
      </p>
      <div className="space-y-2">
        {citations.map((citation) => (
          <div
            key={citation.citationNumber}
            className="rounded-lg border border-[#C7C0B5]/50 bg-[#E8DFD0] p-3"
          >
            <div className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E8721A]/20 text-xs font-bold text-[#E8721A]">
                {citation.citationNumber}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#2C3328]">
                  {citation.sourceBook}
                </p>
                <p className="mt-1 text-sm text-[#6B6B6B] italic">
                  &ldquo;{citation.excerptText}&rdquo;
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}