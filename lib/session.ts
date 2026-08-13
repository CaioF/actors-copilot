import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { SubscriptionTier, SubscriptionStatus } from './billing';

/**
 * Expected payload structure encoded within the signed platform session JWT.
 * @interface PlatformSession
 */
export interface PlatformSession {
  uid: string;
  email: string;
  tier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodEnd?: number;
}

const SESSION_COOKIE_NAME = 'platform_session';
const JWT_SECRET = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('❌ CRITICAL: JWT_SECRET_KEY or JWT_SECRET is missing from environment variables.');
}

const encodedSecret = new TextEncoder().encode(JWT_SECRET);

/**
 * Encrypts and signs user billing and identity metadata into a secure JWT.
 * * @param {PlatformSession} payload - The refined session state derived from corporate data records.
 * @returns {Promise<string>} The cryptographically signed JWT token.
 */
export async function encryptSession(payload: PlatformSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Explicit token longevity set to 1 week
    .sign(encodedSecret);
}

/**
 * Decrypts and cryptographically verifies an inbound platform session token.
 * Returns null gracefully if signature verification or expiration check fails.
 * * @param {string} sessionToken - The raw encrypted token extracted from HTTP request headers/cookies.
 * @returns {Promise<PlatformSession | null>} De-serialized token payload content, or null if corrupted.
 */
export async function decryptSession(sessionToken: string): Promise<PlatformSession | null> {
  try {
    const { payload } = await jwtVerify(sessionToken, encodedSecret, {
      algorithms: ['HS256'],
    });
    return payload as unknown as PlatformSession;
  } catch (error) {
    console.error('⚠️ Platform session token decryption failed:', error);
    return null;
  }
}

/**
 * Commits the platform session state to the client browser using highly secure HTTP-Only cookie contexts.
 * * @param {PlatformSession} payload - The explicit state parameters to persist in the session cookie.
 * @returns {Promise<void>}
 */
export async function setPlatformSession(payload: PlatformSession): Promise<void> {
  const token = await encryptSession(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // Restrict persistence matrix to exactly 7 days
  });
}

/**
 * High-performance abstraction to read and validate the active session context from incoming edge layers.
 * * @returns {Promise<PlatformSession | null>} The verified session properties or null if unauthenticated.
 */
export async function getPlatformSession(): Promise<PlatformSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;
  return decryptSession(token);
}

/**
 * Expunges the authentication session identifiers, processing an instantaneous state purge for sign-out pipelines.
 * * @returns {Promise<void>}
 */
export async function deletePlatformSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}