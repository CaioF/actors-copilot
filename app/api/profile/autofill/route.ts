import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase.admin';
import { IMDB_AUTOFILL_PROMPT } from '@/lib/prompts';
import type { ImdbExtractedData, Credit, Showreel } from '@/lib/imdb-types';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function parseIMDBMarkdown(markdown: string, metadata: any): ImdbExtractedData {
  const lines = markdown.split('\n');
  let fullName = metadata?.title?.replace(' - IMDb', '') || '';
  let bio = '';
  let height = '';
  let location = '';
  const credits: Credit[] = [];
  const showreels: Showreel[] = [];
  const knownFor: any[] = [];

  // Parse markdown lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Extract name from heading
    if (line.startsWith('# ')) {
      fullName = line.substring(2).trim();
      continue;
    }

    // Extract bio snippets
    if (line.startsWith('- ') && !height && !location) {
      if (line.includes('Born') || line.includes('United') || line.includes('UK') || line.includes('USA') || line.includes('Canada')) {
        // Birth info line
        const birthMatch = line.match(/Born\s+(.+)/i);
        const locationMatch = line.match(/(United Kingdom|United States|USA|UK|Canada|Australia|Germany|France)/i);
        if (birthMatch) {
          const birthInfo = birthMatch[1];
          const heightMatch = birthInfo.match(/(\d+′\s*\d+″|\d+\s*cm)/);
          if (heightMatch) {
            height = heightMatch[1];
          }
        }
        if (locationMatch) {
          location = locationMatch[1];
        }
      }
    }

    // Extract height from personal details
    if (line.includes("Height") && line.includes('(')) {
      const heightMatch = line.match(/\((\d+['"′"]?\s*\d*["′"]?\s*\/?\s*\d+\s*(cm|m)?\))/);
      if (!heightMatch) {
        const simpleMatch = line.match(/(\d+′+\s*\d+″+|\d+\s*cm)/);
        if (simpleMatch) {
          height = simpleMatch[1];
        }
      }
    }

    // Extract credits from "Known for" section
    if (line.includes('Known for') || line.includes('known for')) {
      // Look at next lines for credits
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const creditLine = lines[j].trim();
        if (creditLine.startsWith('- ') && creditLine.includes('(')) {
          const yearMatch = creditLine.match(/\((\d{4})\)/);
          const roleMatch = creditLine.match(/\-\s+(.+?)\s+\(/);
          const titleMatch = creditLine.match(/^(.+?)\s+\(/);

          if (titleMatch && yearMatch) {
            knownFor.push({
              title: titleMatch[1].trim(),
              year: yearMatch[1],
              role: roleMatch ? roleMatch[1].trim() : '',
            });
          }
        }
        if (creditLine.startsWith('#') || creditLine.includes('##')) break;
      }
    }

    // Extract credits from "Credits" section
    if (line.includes('Actress') || line.includes('Actor') || line.includes('Credits')) {
      let foundCredits = false;
      for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
        const creditLine = lines[j].trim();

        // Stop at next section
        if (creditLine.startsWith('#') || creditLine.includes('Videos') || creditLine.includes('Photos')) {
          break;
        }

        if (creditLine.startsWith('- ') && creditLine.match(/\(\d{4}\)/)) {
          const yearMatch = creditLine.match(/\((\d{4})\)/);
          const roleMatch = creditLine.match(/\-\s+(.+?)\s+\(/);
          const titleMatch = creditLine.match(/^(.+?)\s+\(/);

          if (titleMatch && yearMatch) {
            const title = titleMatch[1].trim();
            const year = yearMatch[1];

            // Determine category based on context
            let category: Credit['category'] = 'further';
            if (line.toLowerCase().includes('television') || line.toLowerCase().includes('tv')) {
              category = 'television';
            } else if (line.toLowerCase().includes('feature') || line.toLowerCase().includes('film')) {
              category = 'feature_film';
            } else if (line.toLowerCase().includes('stage') || line.toLowerCase().includes('theatre')) {
              category = 'stage';
            } else if (line.toLowerCase().includes('commercial')) {
              category = 'commercial';
            }

            credits.push({
              title,
              role: roleMatch ? roleMatch[1].trim() : '',
              year,
              category,
              featured: knownFor.some(k => k.title === title),
            });
          }
        }
      }
    }

    // Extract video/showreel URLs
    if (line.includes('Video') || line.includes('Showreel') || line.includes('Demo Reel')) {
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

  // Extract bio from metadata description if available
  if (!bio && metadata?.description) {
    bio = metadata.description.substring(0, 500);
  }

  return {
    fullName,
    slug: generateSlug(fullName),
    headshot: metadata?.ogImage || null,
    bio,
    height,
    location,
    credits,
    showreels,
    knownFor,
  };
}

export async function POST(request: Request) {
  try {
    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (error: any) {
      console.error('Token verification failed:', error.message);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 });
    }

    const { url } = body;

    // URL validation
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    if (typeof url !== 'string' || url.trim() === '') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // IMDB URL format validation
    const imdbPattern = /\/name\/nm\d+/;
    if (!imdbPattern.test(url)) {
      return NextResponse.json(
        { error: 'Invalid IMDB URL format. Must match pattern: /name/nm\\d+' },
        { status: 400 }
      );
    }

    // Firecrawl API call
    const firecrawlResponse = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
      }),
    });

    if (!firecrawlResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch data from IMDB' },
        { status: 502 }
      );
    }

    const firecrawlData = await firecrawlResponse.json();

    if (!firecrawlData.success) {
      return NextResponse.json(
        { error: 'Failed to fetch data from IMDB' },
        { status: 502 }
      );
    }

    // Fetch DNA profile from Firestore
    const { doc, getDoc } = await import('firebase/firestore');
    const { getDb } = await import('@/lib/firebase');

    const userPath = `${decodedToken.uid}_${decodedToken.email?.split('@')[0] || 'user'}`;
    const profileRef = doc(getDb(), `users/${userPath}/profile/master`);
    const profileSnap = await getDoc(profileRef);

    let dnaData = null;
    if (profileSnap.exists()) {
      dnaData = profileSnap.data();
    }

    // Extract IMDB data from markdown
    const imdbExtracted = parseIMDBMarkdown(
      firecrawlData.data.markdown,
      firecrawlData.data.metadata
    );

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

    // Call Vertex AI for synthesis
    const model = getGenerativeModel(ai, {
      model: 'gemini-2.5-flash',
      systemInstruction: { role: 'user', parts: [{ text: IMDB_AUTOFILL_PROMPT }] },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      } as any,
    });

    const synthesisPrompt = `
IMDB DATA:
${firecrawlData.data.markdown}

${dnaContext ? `ACTOR'S DNA:
${JSON.stringify(dnaContext, null, 2)}` : 'No DNA profile found. Use only IMDB data.'}
`;

    const result = await model.generateContent(synthesisPrompt);
    const responseText = result.response.text().trim();

    // Parse AI response
    let synthesizedData;
    try {
      // Remove markdown code blocks if present
      const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      synthesizedData = JSON.parse(cleanJson);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
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
      location: synthesizedData.location || imdbExtracted.location,
      credits: synthesizedData.credits?.length > 0 ? synthesizedData.credits : imdbExtracted.credits,
      showreels: synthesizedData.showreels?.length > 0 ? synthesizedData.showreels : imdbExtracted.showreels,
    };

    return NextResponse.json({
      success: true,
      data: finalData,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Autofill error:', error);

    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
