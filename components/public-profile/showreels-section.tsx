import { Video } from "lucide-react";

interface ShowreelsSectionProps {
  showreels: { title: string; url: string }[];
}

export function ShowreelsSection({ showreels }: ShowreelsSectionProps) {
  return (
    <section>
      <h2 className="mb-4 font-title text-xl font-bold text-[#212121]">Showreels</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {showreels
          .filter((s) => s.url)
          .map((showreel, i) => (
            <a
              key={i}
              href={showreel.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-28 w-36 flex-shrink-0 flex-col items-center justify-center gap-2 rounded-xl bg-[#555A4A] px-3 text-center transition-colors hover:bg-[#494E3E]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors group-hover:bg-white/20">
                <Video className="h-4 w-4 text-white" />
              </div>
              <p className="line-clamp-2 text-xs leading-tight text-white">
                {showreel.title}
              </p>
            </a>
          ))}
      </div>
    </section>
  );
}
