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

/**
 * Custom static icons mapping.
 */
const CUSTOM_STATIC_ICONS: Partial<Record<ExternalProfileKey, string>> = {
  spotlight: "/star.png", 
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

  // Verifica se temos uma logo estática definida para essa plataforma
  const staticIconUrl = CUSTOM_STATIC_ICONS[platformKey];

  /**
   * SENIOR FIX: Enterprise Favicon Resolution
   * Se existir uma logo estática (ex: Spotlight), usa ela. Se não, tenta buscar no Google.
   */
  const iconSourceUrl = staticIconUrl || (hostname 
    ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=64` 
    : null);

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={`Visit ${label} profile`}
      className="group flex h-9 w-9 items-center justify-center rounded-full bg-[#E8DFD0] text-[#494E3E] transition-all hover:bg-[#FF751F] hover:text-white"
    >
      {!imageError && iconSourceUrl ? (
        <img 
          src={iconSourceUrl} 
          alt={`${label} logo`}
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