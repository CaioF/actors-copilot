"use client";

import { Video } from "lucide-react";

interface ShowreelsSectionProps {
  showreels: { 
    title: string; 
    url: string; 
    /**
     * Optional thumbnail extracted from the video file.
     * When present, it overlays the default olive background placeholder.
     */
    thumbnailUrl?: string; 
  }[];
}

/**
 * Public display component for actor showreels.
 * Renders an optimized horizontal scrolling list of video cards.
 * Implements a graceful fallback pattern: if a custom thumbnailUrl 404s or is absent,
 * it safely defaults to the branded olive placeholder without requiring component state overhead.
 */
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
              {/* Top area: Set to relative to allow absolute positioning of the image over the fallback.
                The olive background acts as the default state. 
              */}
              <div className="relative flex h-24 w-full items-center justify-center bg-[#555A4A] overflow-hidden">
                
                {/* Fallback Element (Always rendered in the background layer) */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors group-hover:bg-white/20">
                  <Video className="h-5 w-5 text-white" />
                </div>

                {/* Conditional Thumbnail Layer */}
                {showreel.thumbnailUrl && (
                  <>
                    <img
                      src={showreel.thumbnailUrl}
                      alt={showreel.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e) => {
                        // Failsafe: Hide broken image instantly to reveal the olive fallback below
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    
                    {/* Play icon overlay on hover (only applicable when thumbnail obscures the base fallback) */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                        <Video className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {/* Bottom area: Fixed height to maintain uniform card layout */}
              <div className="flex h-12 items-center bg-[#494E3E] px-3">
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