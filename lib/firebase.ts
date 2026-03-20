import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Client-side Firebase configuration object.
 * Values are securely injected at build time via Next.js public environment variables.
 */
// TODO: integrating a schema validation library (e.g., Zod) to enforce the presence of these environment variables during the build process, preventing runtime crashes.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Lazy singletons — only initialized when first accessed, avoiding
// module-evaluation crashes when env vars are missing or empty.
let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;

/**
 * Initializes and retrieves the Firebase application instance.
 * Utilizes a lazy singleton pattern to ensure the app is only initialized once,
 * avoiding "App already exists" errors during Next.js Fast Refresh (hot-reloading).
 *
 * @returns {FirebaseApp} The active Firebase application instance.
 */
export function getApp(): FirebaseApp {
  if (!_app) {
    _app =
      getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

/**
 * Retrieves the Firestore database instance associated with the active Firebase app.
 * Supports connecting to a specific database ID if defined in the environment.
 *
 * @returns {Firestore} The initialized Firestore database instance.
 */
export function getDb(): Firestore {
  if (!_db) {
    const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)";
    _db = getFirestore(getApp(), databaseId);
  }
  return _db;
}

/**
 * Validates the presence of required Firebase environment variables.
 * Used defensively across the application to provide graceful fallbacks or mock data
 * when the application is run in an environment without proper Firebase configuration.
 *
 * @returns {boolean} True if all strictly required configuration variables are populated, false otherwise.
 */
export function isFirebaseConfigured(): boolean {
  const required = [
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  ];
  return required.every((v) => !!v && v !== "undefined" && v.length > 0);
}