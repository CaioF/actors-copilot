import { cn } from './utils';
import { generateSlug } from './profile-types';

describe('cn', () => {
    it('combines two simple class names', () => {
        expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('combines classes with spaces (non-conflicting classes preserved)', () => {
        expect(cn('px-2 py-4')).toBe('px-2 py-4');
    });

    it('handles conflicting tailwind classes (last one wins)', () => {
        expect(cn('text-red text-blue')).toBe('text-blue');
    });

    it('filters out falsy values (undefined, null, false)', () => {
        expect(cn(undefined, null, false)).toBe('');
    });

    it('handles nested arrays', () => {
        expect(cn(['a', ['b', 'c']])).toBe('a b c');
    });
});

describe('generateSlug', () => {
    it('converts "John Doe" to "john-doe"', () => {
        expect(generateSlug('John Doe')).toBe('john-doe');
    });

    it('trims and converts "  Jane Smith  " to "jane-smith"', () => {
        expect(generateSlug('  Jane Smith  ')).toBe('jane-smith');
    });

    it('removes apostrophes from "O\'Brien\'s Film" to "obriens-film"', () => {
        expect(generateSlug("O'Brien's Film")).toBe('obriens-film');
    });

    it('collapses multiple spaces to single hyphens', () => {
        expect(generateSlug('  Multiple   Spaces  ')).toBe('multiple-spaces');
    });

    it('collapses consecutive dashes to single dash', () => {
        expect(generateSlug('Test---Dash')).toBe('test-dash');
    });

    it('passes through already-slugified input', () => {
        expect(generateSlug('Already-slug')).toBe('already-slug');
    });

    it('converts uppercase to lowercase', () => {
        expect(generateSlug('UPPERCASE')).toBe('uppercase');
    });

    it('removes special characters', () => {
        expect(generateSlug('Special!@#$chars')).toBe('specialchars');
    });

    it('returns empty string for empty input', () => {
        expect(generateSlug('')).toBe('');
    });
});
