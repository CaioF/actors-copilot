jest.mock('next/server', () => ({}));

jest.mock('@/lib/firebase.admin', () => ({
    auth: { verifyIdToken: jest.fn() },
    db: {},
}));

jest.mock('@/lib/logger', () => ({
    logger: {},
    createChildLogger: jest.fn(() => ({})),
}));

jest.mock('@/lib/prompts', () => ({ IMDB_AUTOFILL_PROMPT: '' }));

jest.mock('@/lib/imdb-types', () => ({}));

import { parseIMDBMarkdown } from './route';

describe('parseIMDBMarkdown', () => {
    const baseMetadata = {
        title: 'Test Actor - IMDb',
        ogImage: 'https://example.com/headshot.jpg',
        description: 'Test bio description',
    };

    describe('Valid markdown with credits', () => {
        it('extracts name from heading and parses known credits', () => {
            const markdown = `# Tracey Collis

Actress

- Born July 5, 1961 in United Kingdom

## Known for
- The Great Film (2020) - Actress
- Another Show (2019) - Lead Role

## Credits
- Television
  - TV Series One (2021) - Main Role
  - TV Series Two (2020) - Guest Star
- Feature Film
  - Movie One (2019) - Supporting Role
  - Movie Two (2018) - Lead Role`;

            const result = parseIMDBMarkdown(markdown, baseMetadata);

            expect(result.fullName).toBe('Tracey Collis');
            expect(result.knownFor).toEqual([
                { title: 'The Great Film', year: '2020', role: 'Actress', imageUrl: '' },
                { title: 'Another Show', year: '2019', role: 'Lead Role', imageUrl: '' },
            ]);
        });

        it('extracts location from birth info', () => {
            const markdown = `# Test Actor

- Born June 15, 1980 in United States`;

            const result = parseIMDBMarkdown(markdown, baseMetadata);

            expect(result.location).toBe('United States');
        });

        it('extracts height when present in birth info with cm', () => {
            const markdown = `# Test Actor

- Born June 15, 1980 in Los Angeles, California 175 cm`;

            const result = parseIMDBMarkdown(markdown, baseMetadata);

            expect(result.height).toBe('175 cm');
        });
    });

    describe('Missing sections', () => {
        it('returns empty credits array when no credits section exists', () => {
            const markdown = `# Actor With No Credits

Just an actor with no credits yet.`;

            const result = parseIMDBMarkdown(markdown, baseMetadata);

            expect(result.credits).toEqual([]);
        });

        it('handles missing metadata gracefully', () => {
            const markdown = `# Solo Actor`;

            const result = parseIMDBMarkdown(markdown, {});

            expect(result.fullName).toBe('Solo Actor');
            expect(result.headshot).toBeNull();
        });

        it('uses metadata description as fallback bio', () => {
            const markdown = `# Actor Name`;

            const result = parseIMDBMarkdown(markdown, {
                ...baseMetadata,
                description: 'This is a fallback bio from metadata.',
            });

            expect(result.bio).toBe('This is a fallback bio from metadata.');
        });
    });

    describe('Malformed credit lines', () => {
        it('skips malformed known-for lines without year', () => {
            const markdown = `# Test Actor

## Known for
- Movie Without Year - Role
- Another Movie (2020) - Valid Role`;

            const result = parseIMDBMarkdown(markdown, baseMetadata);

            expect(result.knownFor).toHaveLength(1);
            expect(result.knownFor[0].title).toBe('Another Movie');
        });

        it('skips lines without year in credits section', () => {
            const markdown = `# Test Actor

## Credits
- Feature Film
  - Movie Without Year
  - Movie With Year (2019) - Actual Role`;

            const result = parseIMDBMarkdown(markdown, baseMetadata);

            expect(result.credits.some(c => c.title === 'Movie With Year')).toBe(true);
        });
    });

    describe('Empty markdown', () => {
        it('uses metadata title for name when markdown is empty', () => {
            const result = parseIMDBMarkdown('', baseMetadata);

            expect(result.fullName).toBe('Test Actor');
            expect(result.credits).toEqual([]);
            expect(result.showreels).toEqual([]);
        });

        it('uses metadata title when markdown has only whitespace', () => {
            const result = parseIMDBMarkdown('   \n\n   ', baseMetadata);

            expect(result.fullName).toBe('Test Actor');
        });

        it('prefers markdown heading over metadata title', () => {
            const markdown = `# Just A Name`;

            const result = parseIMDBMarkdown(markdown, baseMetadata);

            expect(result.fullName).toBe('Just A Name');
            expect(result.credits).toEqual([]);
        });
    });
});
