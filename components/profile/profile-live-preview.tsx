"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { Play, Download, ArrowRight, Award } from "lucide-react";
import { ActorProfile } from "@/lib/profile-types";

/**
 * A live preview component that displays how the actor profile will appear publicly.
 * Updates in real-time as form values change.
 */
export function ProfileLivePreview() {
  const { control } = useFormContext<ActorProfile>();

  const fullName = useWatch({ control, name: "fullName" });
  const playingAgeMin = useWatch({ control, name: "playingAgeMin" });
  const playingAgeMax = useWatch({ control, name: "playingAgeMax" });
  const location = useWatch({ control, name: "location" });
  const agencyName = useWatch({ control, name: "agencyName" });
  const height = useWatch({ control, name: "height" });
  const eyeColour = useWatch({ control, name: "eyeColour" });
  const hairColour = useWatch({ control, name: "hairColour" });
  const awardsCallout = useWatch({ control, name: "awardsCallout" });
  const bio = useWatch({ control, name: "bio" });
  const credits = useWatch({ control, name: "credits" });
  const skillsAndAccents = useWatch({ control, name: "skillsAndAccents" });
  const showreels = useWatch({ control, name: "showreels" });
  const cvUrl = useWatch({ control, name: "cvUrl" });
  const headshot = useWatch({ control, name: "headshot" });

  const ageRange =
    playingAgeMin && playingAgeMax
      ? `Playing age: ${playingAgeMin}–${playingAgeMax}`
      : null;

  const featuredCredits = credits?.filter((c) => c.title).slice(0, 3) || [];
  const hasShowreels = showreels?.some((s) => s.url);
  const firstShowreelUrl = showreels?.find((s) => s.url)?.url;

  return (
    <div className="sticky top-8">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#6B6B6B]">
        LIVE PREVIEW
      </p>

      <div className="overflow-hidden rounded-2xl bg-[#3D4A3C] text-[#C7C7C7]">
        {/* Header with headshot */}
        <div className="relative px-5 pb-4 pt-5">
          {headshot && (
            <div className="mb-3 h-16 w-16 overflow-hidden rounded-full border-2 border-[#F5F0E8]/20">
              <img src={headshot} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <p className="text-lg font-bold text-white">
            {fullName || ""}
          </p>
          {ageRange && <p className="text-xs text-[#C7C7C7]">{ageRange}</p>}
          {location && <p className="text-xs text-[#C7C7C7]">{location}</p>}
          {agencyName && (
            <p className="text-xs text-[#C7C7C7]">Rep: {agencyName}</p>
          )}
        </div>

        {/* Divider */}
        <div className="mx-5 border-t border-white/10" />

        {/* Physical Details */}
        {(height || eyeColour || hairColour) && (
          <>
            <div className="space-y-1.5 px-5 py-3">
              {height && (
                <div className="flex justify-between text-xs">
                  <span>Height</span>
                  <span>{height}</span>
                </div>
              )}
              {eyeColour && (
                <div className="flex justify-between text-xs">
                  <span>Eyes</span>
                  <span>{eyeColour}</span>
                </div>
              )}
              {hairColour && (
                <div className="flex justify-between text-xs">
                  <span>Hair</span>
                  <span>{hairColour}</span>
                </div>
              )}
            </div>
            <div className="mx-5 border-t border-white/10" />
          </>
        )}

        {/* Awards Callout */}
        {awardsCallout && (
          <>
            <div className="flex items-start gap-2 px-5 py-3">
              <Award className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#E8721A]" />
              <p className="text-xs text-[#E8721A]">{awardsCallout}</p>
            </div>
            <div className="mx-5 border-t border-white/10" />
          </>
        )}

        {/* Bio */}
        {bio && (
          <>
            <div className="px-5 py-3">
              <p className="text-xs leading-relaxed">{bio}</p>
            </div>
            <div className="mx-5 border-t border-white/10" />
          </>
        )}

        {/* Credits */}
        {featuredCredits.length > 0 && (
          <>
            <div className="px-5 py-3">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-[#C7C7C7]">
                CREDITS
              </p>
              <div className="space-y-1.5">
                {featuredCredits.map((credit, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span>{credit.title}</span>
                    <span>
                      {credit.role}
                      {credit.year ? ` - ${credit.year}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mx-5 border-t border-white/10" />
          </>
        )}

        {/* Skills */}
        {skillsAndAccents?.length > 0 && (
          <>
            <div className="px-5 py-3">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-[#C7C7C7]">
                SKILLS
              </p>
              <div className="flex flex-wrap gap-1.5">
                {skillsAndAccents.slice(0, 6).map((skill, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-white/20 px-2.5 py-0.5 text-[10px] text-[#C7C7C7]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
            <div className="mx-5 border-t border-white/10" />
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 px-5 py-4">
          {hasShowreels && firstShowreelUrl && (
            <button
              type="button"
              onClick={() => window.open(firstShowreelUrl, "_blank", "noopener,noreferrer")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#E8721A] px-3 py-2 text-xs font-medium text-white"
            >
              <Play className="h-3 w-3" />
              Showreel
            </button>
          )}
          {cvUrl && (
            <button
              type="button"
              onClick={() => window.open(cvUrl, "_blank", "noopener,noreferrer")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-white"
            >
              <Download className="h-3 w-3" />
              Download CV
            </button>
          )}
        </div>
      </div>

      {/* View Full Profile Link */}
      <button
        type="button"
        className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#E8721A] transition-colors hover:text-[#E8721A]/80"
      >
        <ArrowRight className="h-4 w-4" />
        View full public profile
      </button>
    </div>
  );
}
