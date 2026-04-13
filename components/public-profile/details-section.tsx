import { ActorProfile } from "@/lib/profile-types";

interface DetailsSectionProps {
  profile: ActorProfile;
}

interface DetailRow {
  label: string;
  value: string | null;
}

export function DetailsSection({ profile }: DetailsSectionProps) {
  const ageRange =
    profile.playingAgeMin && profile.playingAgeMax
      ? `${profile.playingAgeMin}–${profile.playingAgeMax}`
      : null;

  const leftColumn: DetailRow[] = [
    { label: "Playing Age", value: ageRange },
    { label: "Gender", value: profile.gender || null },
    { label: "Work Permits", value: profile.workPermits?.length ? profile.workPermits.join(", ") : null },
    { label: "Eye Colour", value: profile.eyeColour || null },
  ];

  const rightColumn: DetailRow[] = [
    { label: "Height", value: profile.height || null },
    { label: "Nationalities", value: profile.nationalities?.length ? profile.nationalities.join(", ") : null },
    { label: "Appearance", value: profile.appearance?.length ? profile.appearance.join(", ") : null },
    { label: "Hair Colour", value: profile.hairColour || null },
  ];

  const hasAnyDetail = [...leftColumn, ...rightColumn].some((row) => row.value);
  if (!hasAnyDetail) return null;

  return (
    <section>
      <h2 className="mb-4 font-title text-xl font-bold text-[#212121]">Details</h2>
      <div className="grid grid-cols-1 gap-x-12 gap-y-0 md:grid-cols-2">
        <DetailColumn rows={leftColumn} />
        <DetailColumn rows={rightColumn} />
      </div>
    </section>
  );
}

function DetailColumn({ rows }: { rows: DetailRow[] }) {
  const filtered = rows.filter((r) => r.value);
  return (
    <div>
      {filtered.map((row, i) => (
        <div key={row.label}>
          <div className="flex items-baseline justify-between py-2.5">
            <span className="text-sm text-[#7E7E7E]">{row.label}</span>
            <span className="text-sm font-medium text-[#212121]">{row.value}</span>
          </div>
          {i < filtered.length - 1 && (
            <div className="h-px bg-[#C7C0B5]/40" />
          )}
        </div>
      ))}
    </div>
  );
}
