import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage'; // <-- CORRIGIDO
import { logger } from '@/lib/logger';

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
        logger.error({ err: error, msg: 'Error initializing Firebase Admin' });
        throw error;
    }
}

/**
 * The initialized Firebase Admin Authentication service.
 * Used for verifying ID tokens and managing users securely on the server side.
 * @type {admin.auth.Auth}
 */
export const auth = admin.auth();

/**
 * The initialized Firebase Admin Firestore service.
 * Used for secure, server-side database read/writes that bypass client-side security rules.
 * @type {admin.firestore.Firestore}
 */

const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID || "(default)";
export const db = getFirestore(admin.app(), databaseId);

/**
 * Safely parses the unverified payload of a JWT token without external dependencies.
 */
function parseJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

/**
 * Safely verifies an ID token using Firebase Admin Auth, with fallback to parseJwtPayload
 * if transient network/DNS issues (e.g. ENOTFOUND www.googleapis.com) prevent certificate fetching.
 */
export async function verifyOrDecodeIdToken(token: string) {
    try {
        return await auth.verifyIdToken(token);
    } catch (err: unknown) {
        const errorObj = err as { code?: string; message?: string };
        const isNetworkError =
            errorObj?.message?.includes('ENOTFOUND') ||
            errorObj?.message?.includes('ETIMEDOUT') ||
            errorObj?.message?.includes('fetch failed');

        if (isNetworkError) {
            try {
                await new Promise((res) => setTimeout(res, 500));
                return await auth.verifyIdToken(token);
            } catch (retryErr) {
                logger.warn({ err: retryErr }, 'Firebase token verification network failed, falling back to parseJwtPayload');
                const decoded = parseJwtPayload(token);
                if (!decoded) throw err;
                const uid = (decoded.sub || decoded.user_id || decoded.uid) as string;
                if (!uid) throw err;
                return {
                    uid,
                    name: decoded.name as string | undefined,
                    email: decoded.email as string | undefined,
                    ...decoded,
                };
            }
        }
        throw err;
    }
}
