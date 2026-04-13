import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines clsx class names with Tailwind CSS merge logic.
 * Resolves Tailwind class conflicts by letting the last class win.
 *
 * @param inputs - Class values to combine (strings, objects, arrays, etc.)
 * @returns A merged class string with Tailwind conflicts resolved
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
