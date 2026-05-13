"use client";

import { 
  Instagram, 
  Linkedin, 
  Globe, 
  Video, 
  Star, 
  Clapperboard, 
  UserCircle, 
  Search, 
  ExternalLink,
  Users,
  Film
} from "lucide-react";
import type { ExternalProfileKey } from "@/lib/profile-types";

/**
 * Enterprise-grade mapping of platform names for accessibility and tooltips.
 */
const PLATFORM_LABELS: Partial<Record<ExternalProfileKey, string>> = {
  imdb: "IMDb",
  spotlight: "Spotlight",
  actorsAccess: "Actors Access",
  backstage: "Backstage",
  castingNetworks: "Casting Networks",
  filmmakersEurope: "Filmmakers Europe",
  eTalenta: "e-TALENTA",
  nawak: "Nawak",
  castingUrl: "Casting",
  castforward: "Castforward",
  showcast: "Showcast",
  castingNetworksAu: "Casting Networks AU",
  talentrack: "Talentrack",
  dazzlerr: "Dazzlerr",
  filmo: "Filmo",
  elencoDigital: "Elenco Digital",
  alternativaTeatral: "Alternativa Teatral",
  castingNetworksSa: "Casting Networks SA",
  starQuality: "Star Quality",
  personalWebsite: "Website",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

/**
 * Mapping table for platform-specific icons.
 * Uses logical visual metaphors for industry-specific platforms 
 * while maintaining brand-accurate icons for social/professional networks.
 */
const ICON_MAP: Record<string, React.ElementType> = {
  imdb: Clapperboard,
  instagram: Instagram,
  linkedin: Linkedin,
  personalWebsite: Globe,
  spotlight: Star,
  actorsAccess: Video,
  backstage: Search,
  castingNetworks: Users,
  filmmakersEurope: Globe,
  eTalenta: Film,
  nawak: UserCircle,
  castingUrl: Video,
  castforward: Search,
  showcast: Film,
  castingNetworksAu: Users,
  talentrack: Users,
  dazzlerr: Star,
  filmo: Film,
  elencoDigital: UserCircle,
  alternativaTeatral: Film,
  castingNetworksSa: Users,
  starQuality: Star,
};

interface PlatformIconProps {
  /** The unique key of the external platform defined in profile-types.ts */
  platformKey: ExternalProfileKey;
  /** The destination URL for the profile link */
  url: string;
}

/**
 * Renders a specialized icon button for an external actor profile.
 * Automatically resolves the correct visual icon based on the platform key 
 * and handles URL normalization.
 * * @component
 * @param {PlatformIconProps} props - The properties for the component.
 * @returns {JSX.Element} A stylized link containing the representative platform icon.
 */
export function PlatformIcon({ platformKey, url }: PlatformIconProps) {
  const label = PLATFORM_LABELS[platformKey] || platformKey;
  
  // Resolve the component with a fallback to a generic link icon
  const IconComponent = ICON_MAP[platformKey] || ExternalLink;

  return (
    <a
      href={url.startsWith("http") ? url : `https://${url}`}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={`Visit ${label} profile`}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8DFD0] text-[#494E3E] transition-all hover:bg-[#FF751F] hover:text-white"
    >
      <IconComponent className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </a>
  );
}