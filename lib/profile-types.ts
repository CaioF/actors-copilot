import { z } from "zod";

// Credit categories used for both Credits and Training sections
export const CREDIT_CATEGORIES = [
  "television",
  "feature_film",
  "stage",
  "commercial",
  "further",
] as const;

export type CreditCategory = (typeof CREDIT_CATEGORIES)[number];

export const CREDIT_CATEGORY_LABELS: Record<CreditCategory, string> = {
  television: "Television",
  feature_film: "Feature Film",
  stage: "Stage",
  commercial: "Commercial",
  further: "Further",
};

// Work permit options shown as selectable badges
export const WORK_PERMIT_OPTIONS = ["UK", "EU", "US", "South Africa", "Other"] as const;

// All external profile platform definitions
export const EXTERNAL_PROFILE_FIELDS = [
  { key: "imdb", label: "IMDB Profile URL", placeholder: "https://imdb.com/name/nm..." },
  { key: "spotlight", label: "Spotlight Profile URL", placeholder: "https://spotlight.com/..." },
  { key: "actorsAccess", label: "Actors Access URL", placeholder: "https://" },
  { key: "backstage", label: "Backstage Profile URL", placeholder: "https://" },
  { key: "castingNetworks", label: "Casting Networks URL", placeholder: "https://" },
  { key: "filmmakersEurope", label: "Filmmakers Europe URL", placeholder: "https://" },
  { key: "eTalenta", label: "e-TALENTA URL", placeholder: "https://" },
  { key: "nawak", label: "Nawak URL", placeholder: "https://" },
  { key: "castingUrl", label: "Casting URL", placeholder: "https://" },
  { key: "castforward", label: "Castforward URL", placeholder: "https://" },
  { key: "showcast", label: "Showcast URL", placeholder: "https://" },
  { key: "castingNetworksAu", label: "Casting Networks AU URL", placeholder: "https://" },
  { key: "talentrack", label: "Talentrack URL", placeholder: "https://" },
  { key: "dazzlerr", label: "Dazzlerr URL", placeholder: "https://" },
  { key: "filmo", label: "Filmo", placeholder: "https://" },
  { key: "elencoDigital", label: "Elenco Digital", placeholder: "https://" },
  { key: "alternativaTeatral", label: "Alternativa Teatral", placeholder: "https://" },
  { key: "castingNetworksSa", label: "Casting Networks South Africa", placeholder: "https://" },
  { key: "starQuality", label: "Star Quality", placeholder: "https://" },
  { key: "personalWebsite", label: "Personal Website URL", placeholder: "https://" },
  { key: "instagram", label: "Instagram Handle", placeholder: "@handle" },
  { key: "linkedin", label: "LinkedIn URL", placeholder: "https://" },
  { key: "facebook", label: "Facebook URL", placeholder: "https://facebook.com/..." },
] as const;

export type ExternalProfileKey = (typeof EXTERNAL_PROFILE_FIELDS)[number]["key"];

// --- Zod Schemas ---

const showreelSchema = z.object({
  title: z.string(),
  url: z.string(),
  thumbnailUrl: z.string().optional(),
});

const creditSchema = z.object({
  category: z.enum(CREDIT_CATEGORIES),
  title: z.string(),
  role: z.string(),
  year: z.string(),
  productionCompany: z.string(),
  featured: z.boolean(),
});

const trainingSchema = z.object({
  category: z.enum(CREDIT_CATEGORIES),
  institution: z.string(),
  qualification: z.string(),
  years: z.string(),
});

const externalProfilesSchema = z.object({
  imdb: z.string(),
  spotlight: z.string(),
  actorsAccess: z.string(),
  backstage: z.string(),
  castingNetworks: z.string(),
  filmmakersEurope: z.string(),
  eTalenta: z.string(),
  nawak: z.string(),
  castingUrl: z.string(),
  castforward: z.string(),
  showcast: z.string(),
  castingNetworksAu: z.string(),
  talentrack: z.string(),
  dazzlerr: z.string(),
  filmo: z.string(),
  elencoDigital: z.string(),
  alternativaTeatral: z.string(),
  castingNetworksSa: z.string(),
  starQuality: z.string(),
  personalWebsite: z.string(),
  instagram: z.string(),
  linkedin: z.string(),
  facebook: z.string()
});

export const actorProfileSchema = z.object({
  // Meta
  slug: z.string(),
  status: z.enum(["draft", "published"]),

  // Photos
  headshot: z.string().nullable(),
  additionalPhotos: z.array(z.string()),

  // Basic Info
  fullName: z.string().min(1, "Full name is required"),
  playingAgeMin: z.number().nullable(),
  playingAgeMax: z.number().nullable(),
  location: z.string(),
  timezone: z.string(),
  gender: z.string(),

  // Physical & Professional
  height: z.string(),
  heightUnit: z.enum(["imperial", "metric"]),
  eyeColour: z.string(),
  hairColour: z.string(),
  nationalities: z.array(z.string()),
  workPermits: z.array(z.string()),
  ethnicity: z.string(),
  appearance: z.array(z.string()),

  // About Me
  awardsCallout: z.string(),
  bio: z.string().max(500, "Bio must be 500 characters or less"),

  // Agent / Representation
  agencyName: z.string(),
  agencyEmail: z.string(),
  agencyWebsite: z.string(),
  agencyPhone: z.string(),
  showContactPublicly: z.boolean(),

  // Showreels
  showreels: z.array(showreelSchema),

  // Credits
  credits: z.array(creditSchema),

  // Training
  training: z.array(trainingSchema),

  // External Profiles
  externalProfiles: externalProfilesSchema,

  // Skills & Accents
  skillsAndAccents: z.array(z.string()),

  // CV
  cvUrl: z.string().nullable(),
  cvFilename: z.string().nullable(),
});

export type ActorProfile = z.infer<typeof actorProfileSchema>;

export const defaultActorProfile: ActorProfile = {
  slug: "",
  status: "draft",
  headshot: null,
  additionalPhotos: [],
  fullName: "",
  playingAgeMin: null,
  playingAgeMax: null,
  location: "",
  timezone: "",
  gender: "",
  height: "",
  heightUnit: "imperial",
  eyeColour: "",
  hairColour: "",
  nationalities: [],
  workPermits: [],
  ethnicity: "",
  appearance: [],
  awardsCallout: "",
  bio: "",
  agencyName: "",
  agencyEmail: "",
  agencyWebsite: "",
  agencyPhone: "",
  showContactPublicly: false,
  showreels: [],
  credits: [],
  training: [],
  externalProfiles: {
    imdb: "",
    spotlight: "",
    actorsAccess: "",
    backstage: "",
    castingNetworks: "",
    filmmakersEurope: "",
    eTalenta: "",
    nawak: "",
    castingUrl: "",
    castforward: "",
    showcast: "",
    castingNetworksAu: "",
    talentrack: "",
    dazzlerr: "",
    filmo: "",
    elencoDigital: "",
    alternativaTeatral: "",
    castingNetworksSa: "",
    starQuality: "",
    personalWebsite: "",
    instagram: "",
    linkedin: "",
    facebook: "",
  },
  skillsAndAccents: [],
  cvUrl: null,
  cvFilename: null,
};

/** Generate a URL-safe slug from a name */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
