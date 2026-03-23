import * as admin from 'firebase-admin';

/**
 * Server-side Firebase Admin initialization.
 * This module securely initializes the Firebase Admin SDK using service account credentials
 * allowing the backend to bypass standard authentication rules and verify JWTs.
 */

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
// Safely parse the private key, ensuring newline characters are formatted correctly for the crypto library
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

// TODO: migrate environment variable validation to a schema-validation library (like Zod) to catch missing secrets at build time rather than runtime.
if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
        'Firebase Admin initialization error: Missing one or more required environment variables (NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).',
    );
}

/**
 * Singleton pattern implementation for Next.js.
 * Ensures the Firebase Admin app is only initialized once, preventing "App already exists"
 * errors during local development hot-reloads (Fast Refresh).
 */
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });

    } catch (error) {
        console.error("Error initializing Firebase Admin:", error);
        throw error;
    }
}

/**
 * The initialized Firebase Admin Authentication service.
 * Used for verifying ID tokens and managing users securely on the server side.
 * @type {admin.auth.Auth}
 */
export const auth = admin.auth();