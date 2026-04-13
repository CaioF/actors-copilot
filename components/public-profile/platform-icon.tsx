import { ExternalLink } from "lucide-react";
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
};

interface PlatformIconProps {
  platformKey: ExternalProfileKey;
  url: string;
}

export function PlatformIcon({ platformKey, url }: PlatformIconProps) {
  const label = PLATFORM_LABELS[platformKey] || platformKey;

  return (
    <a
      href={url.startsWith("http") ? url : `https://${url}`}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#494E3E] text-white/80 transition-colors hover:bg-[#555A4A]"
    >
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}
