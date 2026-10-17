import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

export const ADMIN_SESSION_COOKIE_NAME = 'admin_session';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 2;

const ADMIN_SESSION_ISSUER = 'actors-copilot-admin';
const ADMIN_SESSION_AUDIENCE = 'admin-dashboard';
const ADMIN_SESSION_SUBJECT = 'admin';

export interface AdminSession {
  sub: typeof ADMIN_SESSION_SUBJECT;
  iss: typeof ADMIN_SESSION_ISSUER;
  aud: typeof ADMIN_SESSION_AUDIENCE;
  iat: number;
  exp: number;
}

function requireEnvironmentVariable(name: 'ADMIN_USERNAME' | 'ADMIN_PASSWORD' | 'ADMIN_JWT_SECRET'): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUsername = digest(requireEnvironmentVariable('ADMIN_USERNAME'));
  const expectedPassword = digest(requireEnvironmentVariable('ADMIN_PASSWORD'));
  const usernameMatches = timingSafeEqual(digest(username), expectedUsername);
  const passwordMatches = timingSafeEqual(digest(password), expectedPassword);

  return usernameMatches && passwordMatches;
}

function getEncodedSecret(): Uint8Array {
  return new TextEncoder().encode(requireEnvironmentVariable('ADMIN_JWT_SECRET'));
}

export async function encryptAdminSession(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ADMIN_SESSION_SUBJECT)
    .setIssuer(ADMIN_SESSION_ISSUER)
    .setAudience(ADMIN_SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(getEncodedSecret());
}

export async function decryptAdminSession(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, getEncodedSecret(), {
      algorithms: ['HS256'],
      issuer: ADMIN_SESSION_ISSUER,
      audience: ADMIN_SESSION_AUDIENCE,
      subject: ADMIN_SESSION_SUBJECT,
    });

    return payload as unknown as AdminSession;
  } catch {
    return null;
  }
}

export async function setAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = await encryptAdminSession();

  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  return token ? decryptAdminSession(token) : null;
}

export async function deleteAdminSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
