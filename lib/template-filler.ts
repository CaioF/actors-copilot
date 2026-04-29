/**
 * Regular expression to match placeholders in the format [variable] or [variable:default].
 * Group 1: The variable name (can include spaces, slashes, etc., excluding ']' and ':').
 * Group 2: The optional default value.
 */
export const PLACEHOLDER_REGEX = /\[([^\]:]+)(?::([^\]]+))?\]/g;

/**
 * Extracts all unique placeholder variable names from a template string.
 * For placeholders with defaults (e.g., [role:Hero]), only the variable name ('role') is returned.
 *
 * @param template The template string containing placeholders.
 * @returns An array of unique placeholder variable names.
 */
export function extractPlaceholders(template: string): string[] {
  if (!template) return [];
  
  const matches = Array.from(template.matchAll(PLACEHOLDER_REGEX));
  const keys = matches.map((match) => match[1]);
  
  // Return deduplicated array using Set
  return Array.from(new Set(keys));
}

/**
 * Fills a template string with values from a provided dictionary.
 * If a value is missing in the dictionary but has a default in the template, the default is used.
 * If no value or default is available, the placeholder is left intact.
 *
 * @param template The template string to fill.
 * @param vars A dictionary of values to substitute into the template.
 * @returns The filled string.
 */
export function fillTemplate(
  template: string,
  vars: Record<string, string | undefined>
): string {
  if (!template) return "";
  if (Object.keys(vars).length === 0 && !template.includes(':')) {
    // Fast path: if no vars provided and no defaults exist, we can just return
    // (Note: we still run replace if there are defaults to parse out)
  }

  return template.replace(PLACEHOLDER_REGEX, (originalMatch, name, defaultVal) => {
    const providedValue = vars[name];
    
    // Use provided value if it exists and is not an empty string
    if (providedValue !== undefined && providedValue !== null && providedValue !== "") {
      return providedValue;
    }
    
    // Fallback to default value if defined in the template
    if (defaultVal !== undefined) {
      return defaultVal;
    }
    
    // If neither is available, leave the placeholder exactly as is
    return originalMatch;
  });
}