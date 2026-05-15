"use client";

import { useState } from "react";
import { 
  Instagram, 
  Linkedin, 
  Globe, 
  Video, 
  Facebook,
  Star, 
  Clapperboard, 
  UserCircle, 
  Search, 
  ExternalLink,
  Users,
  Film
} from "lucide-react";
import type { ExternalProfileKey } from "@/lib/profile-types";

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
  facebook: "Facebook",
};

/**
 * Fallback mapping table. 
 * Used only if the dynamic official brand icon fails to load.
 */
const FALLBACK_ICON_MAP: Record<string, React.ElementType> = {
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
  facebook: Facebook,
};

interface PlatformIconProps {
  platformKey: ExternalProfileKey;
  url: string;
}

export function PlatformIcon({ platformKey, url }: PlatformIconProps) {
  const [imageError, setImageError] = useState(false);
  const label = PLATFORM_LABELS[platformKey] || platformKey;
  
  // URL normalization
  const fullUrl = url.startsWith("http") ? url : `https://${url}`;
  
  // Extract hostname safely for dynamic resolution
  let hostname = "";
  try {
    hostname = new URL(fullUrl).hostname;
  } catch (e) {
    console.warn(`Invalid URL provided for ${platformKey}: ${url}`);
  }

  // Fallback to our previous semantic mapping
  const FallbackIcon = FALLBACK_ICON_MAP[platformKey] || ExternalLink;

  /**
   * SENIOR FIX: Enterprise Favicon Resolution
   * Dynamically fetches the official brand icon (64px size for crispness on Retina displays).
   */
  const officialBrandIconUrl = hostname 
    ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=64` 
    : null;

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={`Visit ${label} profile`}
      // Added 'group' to handle hover animations on child elements
      className="group flex h-9 w-9 items-center justify-center rounded-full bg-[#E8DFD0] text-[#494E3E] transition-all hover:bg-[#FF751F] hover:text-white"
    >
      {!imageError && officialBrandIconUrl ? (
        <img 
          src={officialBrandIconUrl} 
          alt={`${label} logo`}
          // Removed the 'text-white' dependency since it's an image, and added a scale-up on hover
          className="h-4 w-4 object-contain transition-transform duration-200 group-hover:scale-110"
          onError={() => setImageError(true)}
        />
      ) : (
        <FallbackIcon className="h-4 w-4" />
      )}
      <span className="sr-only">{label}</span>
    </a>
  );
}