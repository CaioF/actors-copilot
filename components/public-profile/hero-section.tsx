import { Calendar, MapPin, Award, Play, Download, Mail, Phone, Globe, User } from "lucide-react";
import { ActorProfile, EXTERNAL_PROFILE_FIELDS, ExternalProfileKey } from "@/lib/profile-types";
import { PlatformIcon } from "./platform-icon";

interface HeroSectionProps {
  profile: ActorProfile & { lastUpdated?: string };
}

export function HeroSection({ profile }: HeroSectionProps) {
  const firstShowreelUrl = profile.showreels?.find((s) => s.url)?.url;
  const hasAgencyInfo =
    profile.showContactPublicly &&
    (profile.agencyName || profile.agencyEmail || profile.agencyPhone || profile.agencyWebsite);

  const formattedDate = profile.lastUpdated
    ? new Date(profile.lastUpdated).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // Filter external profiles to only show non-empty ones
  const activeProfiles = EXTERNAL_PROFILE_FIELDS.filter(
    (field) => profile.externalProfiles?.[field.key as ExternalProfileKey]
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* Left: Headshot + Info */}
      <div className="flex flex-1 flex-col gap-6 sm:flex-row sm:items-start">
        {/* Photo card */}
        <div className="flex-shrink-0">
          <div className="h-52 w-44 overflow-hidden rounded-2xl bg-[#555A4A]">
            {profile.headshot ? (
              <img
                src={profile.headshot}
                alt={profile.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User className="h-16 w-16 text-[#F5F0E8]/40" />
              </div>
            )}
          </div>
        </div>

        {/* Info column */}
        <div className="flex-1 space-y-3">
          {/* Name */}
          <h1 className="font-title text-2xl font-bold text-[#212121]">
            {profile.fullName}
          </h1>

          {/* Date + Location tags */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#656565]">
            {formattedDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formattedDate}
              </span>
            )}
            {profile.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {profile.location}
              </span>
            )}
          </div>

          {/* Awards callout */}
          {profile.awardsCallout && (
            <div className="flex items-start gap-2 rounded-lg bg-[#FF751F]/8 px-3 py-2">
              <Award className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#FF751F]" />
              <p className="text-sm text-[#FF751F]">{profile.awardsCallout}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {firstShowreelUrl && (
              <a
                href={firstShowreelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#FF751F] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#FF751F]/90"
              >
                <Play className="h-3.5 w-3.5" />
                Watch Showreel
              </a>
            )}
            {profile.cvUrl && (
              <a
                href={profile.cvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[#C7C7C7] bg-white px-4 py-2 text-sm font-medium text-[#212121] transition-colors hover:bg-[#F0E9DE]"
              >
                <Download className="h-3.5 w-3.5" />
                Download CV
              </a>
            )}
          </div>

          {/* Find Me On */}
          {activeProfiles.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium uppercase tracking-wider text-[#7E7E7E]">
                FIND ME ON
              </p>
              <div className="flex flex-wrap gap-2">
                {activeProfiles.map((field) => (
                  <PlatformIcon
                    key={field.key}
                    platformKey={field.key as ExternalProfileKey}
                    url={profile.externalProfiles[field.key as ExternalProfileKey]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Representation */}
      {hasAgencyInfo && (
        <div className="w-full flex-shrink-0 rounded-xl border border-[#C7C0B5] bg-[#F0E9DE] p-5 lg:w-64">
          <p className="text-xs font-medium uppercase tracking-wider text-[#7E7E7E]">
            REPRESENTATION
          </p>
          {profile.agencyName && (
            <p className="mt-1 text-base font-semibold text-[#212121]">
              {profile.agencyName}
            </p>
          )}
          <div className="mt-3 space-y-2">
            {profile.agencyEmail && (
              <a
                href={`mailto:${profile.agencyEmail}`}
                className="flex items-center gap-2 text-sm text-[#7E7E7E] transition-colors hover:text-[#2C3328]"
              >
                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{profile.agencyEmail}</span>
              </a>
            )}
            {profile.agencyPhone && (
              <a
                href={`tel:${profile.agencyPhone}`}
                className="flex items-center gap-2 text-sm text-[#7E7E7E] transition-colors hover:text-[#2C3328]"
              >
                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                {profile.agencyPhone}
              </a>
            )}
            {profile.agencyWebsite && (
              <a
                href={
                  profile.agencyWebsite.startsWith("http")
                    ? profile.agencyWebsite
                    : `https://${profile.agencyWebsite}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[#7E7E7E] transition-colors hover:text-[#2C3328]"
              >
                <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                Website
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
