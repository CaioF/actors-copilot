/**
 * Single navigation entry point for client side redirects.
 *
 * Keeping the browser navigation behind a tiny module makes the redirects
 * observable from unit tests, where the native `window.location` object is
 * not writable.
 *
 * @param url - The absolute or relative destination.
 */
export function redirectTo(url: string): void {
  if (typeof window === 'undefined') return;
  window.location.assign(url);
}
