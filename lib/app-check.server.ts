import { getAppCheck } from "firebase-admin/app-check";
import { logger } from "@/lib/logger";

/**
 * Server-side Firebase App Check token minting.
 * @module
 *
 * Why this exists
 * ---------------
 * Firebase AI Logic (the `firebasevertexai.googleapis.com` proxy used by
 * `firebase/ai`) enforces **Firebase App Check** for the Gemini TTS models.
 * When the request does not carry a valid App Check token the proxy answers:
 *
 *   403 PERMISSION_DENIED - "To access this model, you must enforce
 *   Firebase App Check."
 *
 * The token has to travel with the request in the `X-Firebase-AppCheck`
 * header, otherwise the upstream call is rejected.
 *
 * Every AI call of this application is issued from the server (Next.js route
 * handlers), so the token is minted here with the Firebase Admin SDK, which
 * signs it with the service account key of the project. It is cached until
 * shortly before it expires (default TTL: 1 hour) so a new token is not
 * signed on every request.
 *
 * Enabling App Check enforcement in the Firebase console is still required:
 * Firebase only serves the TTS models to projects that enforce App Check for
 * the Firebase AI Logic API.
 *
 * @see https://firebase.google.com/docs/ai-logic/app-check
 */

/** App ID of the web app that is allowed to call Firebase AI Logic. */
const FIREBASE_APP_ID = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

/** Refresh the cached token this long before it actually expires. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/** Fallback TTL used when the Admin SDK does not report one. */
const DEFAULT_TTL_MS = 60 * 60 * 1000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;
let pendingToken: Promise<string | null> | null = null;

/**
 * Returns a valid App Check token for the Firebase AI Logic requests issued by
 * this server, or `null` when a token could not be minted (for example when
 * the Admin SDK is not configured in this environment).
 *
 * @returns {Promise<string | null>} The App Check token, or null when unavailable.
 */
export async function getServerAppCheckToken(): Promise<string | null> {
  if (!FIREBASE_APP_ID) {
    logger.warn({
      msg: "App Check token skipped: NEXT_PUBLIC_FIREBASE_APP_ID is not configured.",
    });
    return null;
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - REFRESH_MARGIN_MS > now) {
    return cachedToken.token;
  }

  // Collapse concurrent mint requests into a single call.
  if (!pendingToken) {
    pendingToken = (async () => {
      try {
        // Makes sure the Firebase Admin app is initialized before the App
        // Check service is requested. Importing it lazily keeps this module
        // usable in environments without Admin credentials.
        await import("@/lib/firebase.admin");

        const { token, ttlMillis } = await getAppCheck().createToken(FIREBASE_APP_ID);
        cachedToken = {
          token,
          expiresAt: Date.now() + (ttlMillis || DEFAULT_TTL_MS),
        };
        return token;
      } catch (err) {
        // Never break the caller because of App Check: requests without a token
        // still work for every model that does not require enforcement.
        logger.warn({
          err,
          msg: "Unable to mint a Firebase App Check token.",
        });
        return null;
      } finally {
        pendingToken = null;
      }
    })();
  }

  return pendingToken;
}
