/**
 * Parses imperial height values (e.g., "5ft 9in", "5'9\"", "5ft") to centimeters.
 * @param value - The imperial height string to parse
 * @returns The height in centimeters, or null if parsing fails
 */
export const parseImperialToCm = (value: string): number | null => {
  const patterns = [
    /(\d+)\s*[\′']\s*(\d+)\s*[\″"]?$/,
    /(\d+)\s*ft\s*(\d+)\s*in$/i,
    /(\d+)\s*ft$/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      const feet = parseInt(match[1], 10);
      const inches = match[2] ? parseInt(match[2], 10) : 0;
      return Math.round((feet * 12 + inches) * 2.54);
    }
  }
  return null;
};

/**
 * Parses a centimeter value string and converts it to imperial format (e.g., "175cm" to "5' 9").
 * @param value - The metric height string to parse
 * @returns The height in imperial format, or null if parsing fails
 */
export const parseCmToImperial = (value: string): string | null => {
  const cmMatch = value.match(/(\d+)\s*cm$/i);
  if (cmMatch) {
    const cm = parseInt(cmMatch[1], 10);
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return inches === 12 ? `${feet + 1}' 0"` : `${feet}' ${inches}"`;
  }
  return null;
};
