import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase.admin';
import { IMDB_AUTOFILL_PROMPT } from '@/lib/prompts';
import type { ImdbExtractedData, Credit, Showreel, KnownForEntry } from '@/lib/imdb-types';
import { createChildLogger } from '@/lib/logger';
import { generateSlug } from '@/lib/profile-types';

interface FirecrawlMetadata {
  title?: string;
  ogImage?: string;
  description?: string;
}

/**
 * Parses IMDB page markdown content to extract actor profile data including name,
 * bio, height, location, credits, showreels, known-for works, and additional photos.
 * @param markdown - The IMDB page content in markdown format
 * @param metadata - Additional metadata from the scraped page (title, ogImage, description)
 * @returns Structured ImdbExtractedData object with parsed actor information
 */
export function parseIMDBMarkdown(markdown: string, metadata: FirecrawlMetadata): ImdbExtractedData {
  const lines = markdown.split('\n');
  
  // Clean fullName from title metadata (strip - IMDb, - Biography, - Filmography, etc.)
  let fullName = '';
  if (metadata?.title) {
    fullName = metadata.title.replace(/\s*-\s*(IMDb|Biography|Filmography|Photos|News|Mini Bio).*/i, '').trim();
  }
  
  let bio = '';
  let height = '';
  let location = '';
  const credits: Credit[] = [];
  const showreels: Showreel[] = [];
  const knownFor: KnownForEntry[] = [];

  let currentCategory: Credit['category'] = 'further';
  let inCreditsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Heading name extraction: # Full Name
    if (line.startsWith('# ')) {
      const h1Name = line.substring(2).trim();
      if (h1Name && !h1Name.toLowerCase().includes('imdb')) {
        fullName = h1Name;
      }
    }

    // Extract Birthplace / Location from "Born" or "Personal Details"
    if (!location && (line.toLowerCase().includes('born') || line.toLowerCase().includes('birth place'))) {
      const bornMatch = line.match(/(?:Born|Birth Place)[:\s]+(?:in\s+)?([A-Za-z0-9\s,\.\-–—]+?)(?:\s+\d{1,4}\s*cm|\s+\d+′|\s*\(|$)/i);
      if (bornMatch && bornMatch[1]) {
        const extractedLoc = bornMatch[1].replace(/^(?:on\s+)?[A-Za-z]+\s+\d{1,2},\s+\d{4}\s+(?:in\s+)?/i, '').trim();
        if (extractedLoc && extractedLoc.length > 2 && !extractedLoc.startsWith('http')) {
          location = extractedLoc.replace(/,$/, '').trim();
        }
      }
    }

    // Extract Height (Imperial e.g. 5′ 9″ / 5'9" / 5 ft 9 in OR Metric e.g. 175 cm / 1.75 m)
    if (!height && (line.toLowerCase().includes('height') || line.includes('′') || line.includes('cm') || line.includes('m'))) {
      const heightMatch = line.match(/(\d+['"′']\s*\d*["′"]?|\d+\s*ft\s*\d*\s*in|\d{3}\s*cm|\d\.\d{2}\s*m)/i);
      if (heightMatch) {
        height = heightMatch[1].trim();
      }
    }

    // "Known For" section detection & parsing
    if (line.toLowerCase().includes('known for')) {
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const kLine = lines[j].trim();
        if (kLine.startsWith('## ') || kLine.startsWith('# ')) break;
        
        const cleanKLine = kLine.replace(/^-\s+/, '');
        const titleMatch = cleanKLine.match(/^(?:\[(.*?)\]\(.*?\)|\*\*(.*?)\*\*|(.*?))\s+\((\d{4})\)\s*(?:[-–—:]\s*|\s+as\s+|\s+)?(.*)?$/i);
        if (titleMatch) {
          const kTitle = (titleMatch[1] || titleMatch[2] || titleMatch[3] || '').trim();
          const kYear = titleMatch[4];
          const kRole = (titleMatch[5] || '').trim().replace(/^as\s+/i, '');
          if (kTitle) {
            knownFor.push({ title: kTitle, year: kYear, role: kRole, imageUrl: '' });
          }
        }
      }
    }

    // Section header tracking for Credits/Filmography
    if (line.toLowerCase().includes('filmography') || line.toLowerCase().includes('credits')) {
      inCreditsSection = true;
    }

    // Category Subheadings (e.g., "#### Television", "### Actor - Feature Film")
    if (line.startsWith('#')) {
      const lower = line.toLowerCase();
      if (lower.includes('television') || lower.includes('tv')) {
        currentCategory = 'television';
        inCreditsSection = true;
      } else if (lower.includes('feature') || lower.includes('film') || lower.includes('movie')) {
        currentCategory = 'feature_film';
        inCreditsSection = true;
      } else if (lower.includes('stage') || lower.includes('theatre') || lower.includes('theater')) {
        currentCategory = 'stage';
        inCreditsSection = true;
      } else if (lower.includes('commercial')) {
        currentCategory = 'commercial';
        inCreditsSection = true;
      } else if (lower.includes('videos') || lower.includes('photos') || lower.includes('personal details')) {
        inCreditsSection = false;
      }
    }

    // Parse Credit Lines under Filmography/Credits sections
    if (inCreditsSection || line.startsWith('- ')) {
      const cleanCreditLine = line.replace(/^-\s+/, '');
      
      const cMatch = cleanCreditLine.match(/^(?:\[(.*?)\]\(.*?\)|\*\*(.*?)\*\*|(.*?))\s+\((?:(?:TV\s+Series\s+)?(\d{4}(?:[–—\-]\d{4}|\s*[–—\-]\s*)?))\)\s*(?:[-–—:]\s*|\s+as\s+|\s+)?(.*)?$/i);
      
      if (cMatch) {
        const title = (cMatch[1] || cMatch[2] || cMatch[3] || '').trim();
        const year = cMatch[4].trim();
        const role = (cMatch[5] || '').trim().replace(/^as\s+/i, '');

        if (title && !credits.some(c => c.title === title && c.year === year)) {
          credits.push({
            title,
            role,
            year,
            category: currentCategory,
            featured: knownFor.some(k => k.title === title),
          });
        }
      }
    }

    // Extract video/showreel URLs
    if (line.toLowerCase().includes('video') || line.toLowerCase().includes('showreel') || line.toLowerCase().includes('demo reel')) {
      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        const videoLine = lines[j].trim();
        const urlMatch = videoLine.match(/https?:\/\/[^\s\)\"\'\]]+/);
        if (urlMatch && urlMatch[0].includes('imdb.com/video')) {
          const titleMatch = videoLine.match(/(.+?)(?:\s*https?:\/\/|$)/);
          showreels.push({
            title: titleMatch ? titleMatch[1].trim() : 'Demo Reel',
            url: urlMatch[0],
          });
        }
      }
    }
  }

  // Fallback bio from metadata description if available
  if (!bio && metadata?.description) {
    bio = metadata.description.substring(0, 500);
  }

  return {
    fullName: fullName || 'Actor Profile',
    slug: generateSlug(fullName || 'actor'),
    headshot: metadata?.ogImage || null,
    bio,
    height,
    location,
    credits,
    showreels,
    knownFor,
  };
}

/**
 * Autofills an actor's profile by scraping IMDB data and synthesizing it with their
 * existing DNA profile using AI for enhanced, personalized content.
 * @param request - HTTP request with authorization token and IMDB profile URL
 * @returns JSON response with synthesized profile data or error message
 * @async
 */
export async function POST(request: Request) {
  const log = createChildLogger({ route: 'autofill' });
  
  try {
    log.debug({ msg: 'Starting autofill request' });

    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      log.warn({ msg: 'Missing or invalid Authorization header' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
      log.debug({ uid: decodedToken.uid, email: decodedToken.email, msg: 'Token verified successfully' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid token';
      log.error({ err: errorMessage, msg: 'Token verification failed' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      log.warn({ msg: 'Invalid JSON body' });
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const { url } = body;

    // URL validation
    if (!url) {
      log.warn({ msg: 'URL is required but was not provided' });
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    if (typeof url !== 'string' || url.trim() === '') {
      log.warn({ msg: 'URL is empty or invalid' });
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // IMDB URL format validation: parse URL and allowlist IMDb hostnames
    let parsedImdbUrl: URL;
    try {
      parsedImdbUrl = new URL(url);
    } catch {
      log.warn({ url, msg: 'Could not parse URL' });
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const allowedHostnames = ['imdb.com', 'www.imdb.com', 'm.imdb.com'];
    if (!allowedHostnames.includes(parsedImdbUrl.hostname)) {
      log.warn({ url, hostname: parsedImdbUrl.hostname, msg: 'URL hostname not allowed' });
      return NextResponse.json(
        { error: 'URL must be from imdb.com' },
        { status: 400 }
      );
    }

    const imdbPattern = /\/name\/nm\d+/;
    if (!imdbPattern.test(parsedImdbUrl.pathname)) {
      log.warn({ url, msg: 'Invalid IMDB URL format' });
      return NextResponse.json(
        { error: 'Invalid IMDB URL format. Must match pattern: /name/nm\\d+' },
        { status: 400 }
      );
    }

    log.debug({ url, msg: 'Fetching IMDB data via Firecrawl' });

    // Firecrawl API call with options to capture full DOM and lazy-loaded accordions
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: false,
        waitFor: 2000,
      }),
    });

    if (!firecrawlResponse.ok) {
      log.error({ status: firecrawlResponse.status, msg: 'Firecrawl API request failed' });
      return NextResponse.json(
        { error: 'Failed to fetch data from IMDB' },
        { status: 502 }
      );
    }

    const firecrawlData = await firecrawlResponse.json();

    if (!firecrawlData.success) {
      log.error({ msg: 'Firecrawl returned unsuccessful response' });
      return NextResponse.json(
        { error: 'Failed to fetch data from IMDB' },
        { status: 502 }
      );
    }

    const markdownLength = firecrawlData.data?.markdown?.length || 0;
    const markdownPreview = firecrawlData.data?.markdown?.slice(0, 200) || '';
    log.debug({ markdownLength, markdownPreview, msg: 'Firecrawl scrape completed successfully' });

    // Fetch DNA profile from Firestore using admin SDK (has full permissions in server context)
    const { db } = await import('@/lib/firebase.admin');

    const firstName = ((decodedToken.name?.split(' ')[0] || 'Actor').replace(/[^a-zA-Z0-9]/g, '') || 'Actor');
    const userPath = `${decodedToken.uid}_${firstName}`;
    log.debug({ userPath, firestorePath: `users/${userPath}/profile/master`, msg: 'Fetching DNA profile from Firestore using admin SDK' });
    
    const profileRef = db.doc(`users/${userPath}/profile/master`);
    const profileSnap = await profileRef.get();

    let dnaData = null;
    if (profileSnap.exists) {
      dnaData = profileSnap.data();
      log.debug({ userPath, msg: 'DNA profile found' });
    } else {
      log.debug({ userPath, msg: 'No DNA profile found, using IMDB data only' });
    }

    // Extract IMDB data from markdown
    const imdbExtracted = parseIMDBMarkdown(
      firecrawlData.data.markdown,
      firecrawlData.data.metadata
    );

    log.debug({ 
      fullName: imdbExtracted.fullName, 
      creditsCount: imdbExtracted.credits.length, 
      knownForCount: imdbExtracted.knownFor.length,
      height: imdbExtracted.height,
      location: imdbExtracted.location,
      msg: 'IMDB markdown parsed successfully' 
    });

    // Initialize Vertex AI
    const { getAI, getGenerativeModel, VertexAIBackend } = await import('firebase/ai');
    const { getApp: getFirebaseApp } = await import('@/lib/firebase');

    const ai = getAI(getFirebaseApp(), { backend: new VertexAIBackend() });

    // Prepare DNA context for AI
    const dnaContext = dnaData ? {
      archetypes: dnaData.acting_fuel?.archetypes || [],
      artisticThemes: dnaData.psychology?.traits?.slice(0, 5) || [],
      coreValues: dnaData.psychology?.coreValues || [],
      keyInfluences: dnaData.history?.keyEntities?.slice(0, 5) || [],
    } : null;

    log.debug({ hasDnaContext: !!dnaContext, msg: 'Calling Vertex AI for synthesis' });

    // Call Vertex AI for synthesis
    const model = getGenerativeModel(ai, {
      model: 'gemini-2.5-flash',
      systemInstruction: { role: 'user', parts: [{ text: IMDB_AUTOFILL_PROMPT }] },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      }
    });

    const synthesisPrompt = `
IMDB DATA:
${firecrawlData.data.markdown}

${dnaContext ? `ACTOR'S DNA:
${JSON.stringify(dnaContext, null, 2)}` : 'No DNA profile found. Use only IMDB data.'}
`;

    const result = await model.generateContent(synthesisPrompt);
    const responseText = result.response.text().trim();

    log.debug({ responseLength: responseText.length, msg: 'Received response from Vertex AI' });

    // Parse AI response
    let synthesizedData;
    try {
      // Remove markdown code blocks if present
      const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      synthesizedData = JSON.parse(cleanJson);
      log.debug({ msg: 'AI response parsed successfully' });
    } catch (error) {
      log.error({ err: error, msg: 'Failed to parse AI response, using fallback data' });
      // Fallback to extracted data
      synthesizedData = {
        fullName: imdbExtracted.fullName,
        slug: imdbExtracted.slug,
        headshot: imdbExtracted.headshot,
        bio: imdbExtracted.bio,
        height: imdbExtracted.height,
        location: imdbExtracted.location,
        credits: imdbExtracted.credits,
        showreels: imdbExtracted.showreels,
      };
    }

    // Merge extracted data with AI synthesis (AI takes priority for structured fields)
    const finalData = {
      fullName: synthesizedData.fullName || imdbExtracted.fullName,
      slug: synthesizedData.slug || imdbExtracted.slug,
      headshot: synthesizedData.headshot || imdbExtracted.headshot,
      bio: synthesizedData.bio || imdbExtracted.bio,
      height: synthesizedData.height || imdbExtracted.height,
      heightUnit: synthesizedData.heightUnit || (imdbExtracted.height.includes('cm') || imdbExtracted.height.includes('m') ? 'metric' : 'imperial'),
      location: synthesizedData.location || imdbExtracted.location,
      timezone: synthesizedData.timezone || '',
      gender: synthesizedData.gender || '',
      nationalities: synthesizedData.nationalities?.length > 0 ? synthesizedData.nationalities : [],
      awardsCallout: synthesizedData.awardsCallout || '',
      skillsAndAccents: synthesizedData.skillsAndAccents?.length > 0 ? synthesizedData.skillsAndAccents : [],
      credits: synthesizedData.credits?.length > 0 ? synthesizedData.credits : imdbExtracted.credits,
      showreels: synthesizedData.showreels?.length > 0 ? synthesizedData.showreels : imdbExtracted.showreels,
      additionalPhotos: synthesizedData.additionalPhotos?.length > 0 ? synthesizedData.additionalPhotos : [],
      playingAgeMin: synthesizedData.playingAgeMin || null,
      playingAgeMax: synthesizedData.playingAgeMax || null,
      eyeColour: synthesizedData.eyeColour || '',
      hairColour: synthesizedData.hairColour || '',
      ethnicity: synthesizedData.ethnicity || '',
      training: synthesizedData.training?.length > 0 ? synthesizedData.training : [],
      externalProfiles: synthesizedData.externalProfiles || {},

      agencyName: synthesizedData.agencyName || '',
      agencyWebsite: synthesizedData.agencyWebsite || '',
      agencyEmail: synthesizedData.agencyEmail || '',
      agencyPhone: synthesizedData.agencyPhone || '',
    };

    log.info({ 
      fullName: finalData.fullName, 
      creditsCount: finalData.credits.length, 
      photosCount: finalData.additionalPhotos.length,
      hasBio: !!finalData.bio,
      msg: 'Autofill completed successfully' 
    });

    return NextResponse.json({
      success: true,
      data: finalData,
    }, { status: 200 });

  } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
      log.error({ err: error, msg: 'Autofill request failed' });
      return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

