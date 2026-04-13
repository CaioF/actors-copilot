interface SkillsSectionProps {
  skills: string[];
}

export function SkillsSection({ skills }: SkillsSectionProps) {
  return (
    <section>
      <h2 className="mb-4 font-title text-xl font-bold text-[#212121]">Skills</h2>
      <div className="flex flex-wrap gap-2">
        {skills.map((skill, i) => (
          <span
            key={i}
            className="rounded-full bg-[#494E3E] px-4 py-1.5 text-xs font-medium text-white"
          >
            {skill}
          </span>
        ))}
      </div>
    </section>
  );
}
