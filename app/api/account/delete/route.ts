import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase.admin';
import { deleteAdminMember } from '@/lib/admin-dashboard/repository';
import { logger } from '@/lib/logger';

const RECENT_AUTH_SECONDS = 5 * 60;
const CLOCK_SKEW_SECONDS = 60;

function bearerToken(request: Request): string | null {
  const match = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
}

function errorCode(error: unknown): unknown {
  return error && typeof error === 'object' && 'code' in error
    ? (error as { code: unknown }).code
    : undefined;
}

function isMissingResource(error: unknown): boolean {
  const code = errorCode(error);
  return code === 5 || code === 'not-found' || code === 'auth/user-not-found';
}

export async function POST(request: Request): Promise<NextResponse> {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  const authTime = decodedToken.auth_time;
  if (
    typeof authTime !== 'number' ||
    authTime < now - RECENT_AUTH_SECONDS ||
    authTime > now + CLOCK_SKEW_SECONDS
  ) {
    return NextResponse.json(
      {
        error: 'Recent authentication required. Please sign in again.',
        code: 'requires-recent-login',
      },
      { status: 403 },
    );
  }

  const uid = decodedToken.uid;
  const failedResources: string[] = [];
  const cleanupSteps: Array<[string, () => Promise<unknown>]> = [
    ['billing', () => db.doc(`users/${uid}/billing/current`).delete()],
    ['user', () => db.doc(`users/${uid}`).delete()],
    ['actorProfile', () => db.doc(`actorProfiles/${uid}`).delete()],
    ['projection', () => deleteAdminMember(uid)],
  ];

  for (const [resource, remove] of cleanupSteps) {
    try {
      await remove();
    } catch (error) {
      if (!isMissingResource(error)) {
        failedResources.push(resource);
      }
    }
  }

  if (failedResources.length > 0) {
    logger.error({
      failedResources,
      msg: 'Account deletion stopped before Auth deletion',
    });
    return NextResponse.json(
      {
        error: 'Account deletion incomplete. Please retry.',
        failedResources,
      },
      { status: 500 },
    );
  }

  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if (!isMissingResource(error)) {
      logger.error({
        failedResources: ['authentication'],
        msg: 'Account data removed but Auth deletion failed',
      });
      return NextResponse.json(
        {
          error: 'Account data was removed, but authentication deletion failed. Please retry.',
          failedResources: ['authentication'],
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ success: true });
}
