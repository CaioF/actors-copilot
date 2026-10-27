import { initializeServerApp, type FirebaseApp } from "firebase/app";
import { getApp } from "@/lib/firebase";
import { getServerAppCheckToken } from "@/lib/app-check.server";

/**
 * Central entry point for every Firebase AI Logic call made from the server.
 * @module
 *
 * `firebase/ai` only attaches an App Check token when the Firebase app it is
 * initialized with is a **Firebase Server App** that carries
 * `settings.appCheckToken`. A regular client app never sends the token, which
 * is why Gemini TTS requests were rejected with:
 *
 *   403 PERMISSION_DENIED - "To access this model, you must enforce Firebase
 *   App Check."
 *
 * `getAiApp()` returns a server app bound to a freshly minted (and cached)
 * App Check token, so every AI route automatically sends it. When no token can
 * be minted the plain client app is returned, preserving the previous
 * behaviour for the models that do not require enforcement.
 *
 * This module is server-only: `initializeServerApp` throws in the browser.
 */

/**
 * Returns the Firebase app that must be used to create AI instances.
 *
 * @returns {Promise<FirebaseApp>} A server app carrying an App Check token when
 * one is available, otherwise the regular Firebase app.
 */
export async function getAiApp(): Promise<FirebaseApp> {
  const appCheckToken = await getServerAppCheckToken();

  if (!appCheckToken) {
    return getApp();
  }

  // `initializeServerApp` derives the app name from a hash of the options, so
  // a rotated token transparently produces a new app instance.
  return initializeServerApp(getApp(), { appCheckToken });
}
