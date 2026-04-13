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
              className="group flex w-40 flex-shrink-0 flex-col overflow-hidden rounded-xl transition-shadow hover:shadow-md"
            >
              {/* Top area: darker olive with play icon */}
              <div className="flex h-24 items-center justify-center bg-[#555A4A]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors group-hover:bg-white/20">
                  <Video className="h-5 w-5 text-white" />
                </div>
              </div>
              {/* Bottom area: slightly lighter olive with title */}
              <div className="bg-[#494E3E] px-3 py-2.5">
                <p className="line-clamp-2 text-xs leading-tight text-white">
                  {showreel.title}
                </p>
              </div>
            </a>
          ))}
      </div>
    </section>
  );
}
