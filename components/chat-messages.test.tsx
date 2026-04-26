jest.mock('@/lib/render-markdown', () => ({ renderMarkdown: (s: string) => s }));

import { getInitials, formatTime } from './chat-messages';

describe('getInitials', () => {
  it('returns initials for two-word name', () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it('returns two-letter initials for single-word name', () => {
    expect(getInitials("Alice")).toBe("AL");
  });

  it('returns "ME" for undefined name', () => {
    expect(getInitials(undefined)).toBe("ME");
  });

  it('returns "ME" for empty string', () => {
    expect(getInitials("")).toBe("ME");
  });

  it('trims whitespace and returns initials', () => {
    expect(getInitials("  Bob  ")).toBe("BO");
  });

  it('returns first and last initials for multi-word name', () => {
    expect(getInitials("Mary Jane Smith")).toBe("MS");
  });
});

describe('formatTime', () => {
  it('returns "2:30PM" for null timestamp', () => {
    expect(formatTime(null)).toBe("2:30PM");
  });

  it('formats Firebase Timestamp object correctly', () => {
    const result = formatTime({ seconds: 1713000000 } as unknown as null);
    expect(typeof result).toBe("string");
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });

  it('returns "2:30PM" for invalid input that throws error', () => {
    expect(formatTime("invalid" as unknown as null)).toBe("2:30PM");
  });

  it('formats Date.now() timestamp correctly', () => {
    const result = formatTime(Date.now() as unknown as null);
    expect(typeof result).toBe("string");
    expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });
});
