interface AboutSectionProps {
  bio: string;
}

export function AboutSection({ bio }: AboutSectionProps) {
  return (
    <section>
      <h2 className="mb-4 font-title text-xl font-bold text-[#212121]">About</h2>
      <p className="text-sm leading-relaxed text-[#7E7E7E]">{bio}</p>
    </section>
  );
}
