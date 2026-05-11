/**
 * Types for IMDB/Firecrawl data extraction, including metadata, responses,
 * credits, showreels, and DNA/synthesized profile structures.
 * @module
 * @exports FirecrawlMetadata, FirecrawlSuccessResponse, FirecrawlErrorResponse,
 *          FirecrawlResponse, ImdbExtractedData, Credit, Showreel, KnownForEntry,
 *          DnaProfile, SynthesizedProfile
 */

export interface FirecrawlMetadata {
    title?: string;
    description?: string;
    language?: string;
    keywords?: string;
    robots?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogUrl?: string;
    ogImage?: string;
    ogSiteName?: string;
    sourceURL?: string;
    statusCode?: number;
    contentType?: string;
}

export interface FirecrawlSuccessResponse {
    success: true;
    data: {
        markdown: string;
        html?: string;
        metadata: FirecrawlMetadata;
    };
}

export interface FirecrawlErrorResponse {
    success: false;
    error: string;
}

export type FirecrawlResponse = FirecrawlSuccessResponse | FirecrawlErrorResponse;

export interface ImdbExtractedData {
    fullName: string;
    slug: string;
    headshot: string | null;
    bio: string;
    height: string;
    location: string;
    credits: Credit[];
    showreels: Showreel[];
    knownFor: KnownForEntry[];
}

export interface Credit {
    title: string;
    role: string;
    year: string;
    category: 'television' | 'feature_film' | 'stage' | 'commercial' | 'further';
    featured: boolean;
}

export interface Showreel {
    title: string;
    url: string;
    thumbnailUrl?: string;
}

export interface KnownForEntry {
    title: string;
    role: string;
    year: string;
    imageUrl: string;
}

export interface DnaProfile {
    psychology?: {
        traits?: string[];
        defenseMechanisms?: string[];
        coreValues?: string[];
        relationalDynamics?: string[];
        emotionalBaseline?: {
            conflictResponse?: string;
            internalFriction?: string;
            vulnerabilityManagement?: string;
        };
        intellectualFramework?: {
            cognitiveStyle?: string;
            attentionToDetail?: string;
        };
    };
    acting_fuel?: {
        coreWounds?: string[];
        unmetNeeds?: string[];
        publicMasks?: string[];
        archetypes?: string[];
    };
    history?: {
        milestones?: Array<{
            event: string;
            emotional_cost: string;
        }>;
        keyEntities?: string[];
    };
    physicality?: {
        somaticTells?: string[];
    };
    baselineHistory?: string;
}

export interface SynthesizedProfile {
    fullName: string;
    slug: string;
    headshot: string | null;
    bio: string;
    height: string;
    heightUnit?: 'imperial' | 'metric';
    location: string;
    gender?: string;
    nationalities?: string[];
    awardsCallout?: string;
    skillsAndAccents?: string[];
    credits: Credit[];
    showreels: Showreel[];
    additionalPhotos?: string[];
}
