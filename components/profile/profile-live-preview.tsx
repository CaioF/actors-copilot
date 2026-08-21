"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { Play, Download, ArrowRight, Award } from "lucide-react";
import { ActorProfile, generateSlug } from "@/lib/profile-types";

/**
 * A live preview component that displays how the actor profile will appear publicly.
 * Updates in real-time as form values change.
 */
export function ProfileLivePreview() {
  const { control } = useFormContext<ActorProfile>();

  const fullName = useWatch({ control, name: "fullName" });
  const slug = useWatch({ control, name: "slug" });
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

  const siteOrigin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const profilePath = `actors/${slug || generateSlug(fullName || "")}`;
  const profileFullUrl = `${siteOrigin}/${profilePath}`;

  return (
    <div className="sticky top-8">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground font-title">
        LIVE PREVIEW
      </p>

      <div className="overflow-hidden rounded-2xl bg-card border border-border text-card-foreground shadow-sm">
        {/* Header with headshot */}
        <div className="relative px-5 pb-4 pt-5">
          {headshot && (
            <div className="mb-3 h-16 w-16 overflow-hidden rounded-full border-2 border-border shadow-sm">
              <img src={headshot} alt="" className="h-full w-full object-cover" />
            </div>
          )}
          <p className="text-lg font-bold font-title text-foreground">
            {fullName || ""}
          </p>
          {ageRange && <p className="text-xs text-muted-foreground">{ageRange}</p>}
          {location && <p className="text-xs text-muted-foreground">{location}</p>}
          {agencyName && (
            <p className="text-xs text-muted-foreground">Rep: {agencyName}</p>
          )}
        </div>

        {/* Divider */}
        <div className="mx-5 border-t border-border" />

        {/* Physical Details */}
        {(height || eyeColour || hairColour) && (
          <>
            <div className="space-y-1.5 px-5 py-3">
              {height && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Height</span>
                  <span className="text-foreground font-medium">{height}</span>
                </div>
              )}
              {eyeColour && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Eyes</span>
                  <span className="text-foreground font-medium">{eyeColour}</span>
                </div>
              )}
              {hairColour && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Hair</span>
                  <span className="text-foreground font-medium">{hairColour}</span>
                </div>
              )}
            </div>
            <div className="mx-5 border-t border-border" />
          </>
        )}

        {/* Awards Callout */}
        {awardsCallout && (
          <>
            <div className="flex items-start gap-2 px-5 py-3 bg-primary/10">
              <Award className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <p className="text-xs font-semibold text-primary">{awardsCallout}</p>
            </div>
            <div className="mx-5 border-t border-border" />
          </>
        )}

        {/* Bio */}
        {bio && (
          <>
            <div className="px-5 py-3">
              <p className="text-xs leading-relaxed text-foreground/90">{bio}</p>
            </div>
            <div className="mx-5 border-t border-border" />
          </>
        )}

        {/* Credits */}
        {featuredCredits.length > 0 && (
          <>
            <div className="px-5 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-title">
                CREDITS
              </p>
              <div className="space-y-1.5">
                {featuredCredits.map((credit, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-foreground font-semibold">{credit.title}</span>
                    <span className="text-muted-foreground">
                      {credit.role}
                      {credit.year ? ` - ${credit.year}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mx-5 border-t border-border" />
          </>
        )}

        {/* Skills */}
        {skillsAndAccents?.length > 0 && (
          <>
            <div className="px-5 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-title">
                SKILLS
              </p>
              <div className="flex flex-wrap gap-1.5">
                {skillsAndAccents.slice(0, 6).map((skill, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[10px] text-foreground font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
            <div className="mx-5 border-t border-border" />
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 px-5 py-4">
          {hasShowreels && firstShowreelUrl && (
            <button
              type="button"
              onClick={() => window.open(firstShowreelUrl, "_blank", "noopener,noreferrer")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
            >
              <Play className="h-3 w-3" />
              Showreel
            </button>
          )}
          {cvUrl && (
            <button
              type="button"
              onClick={() => window.open(cvUrl, "_blank", "noopener,noreferrer")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
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
        onClick={() => window.open(profileFullUrl, "_blank", "noopener,noreferrer")}
        className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
      >
        <ArrowRight className="h-4 w-4" />
        View full public profile
      </button>
    </div>
  );
}
