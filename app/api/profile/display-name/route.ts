import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase.admin';
import { syncAdminMember } from '@/lib/admin-dashboard/sync';
import { logger } from '@/lib/logger';

function bearerToken(request: Request): string | null {
  const match = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    ({ uid } = await auth.verifyIdToken(token));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (Object.keys(body).length !== 1 || typeof body.displayName !== 'string') {
    return NextResponse.json({ error: 'displayName is required' }, { status: 400 });
  }

  const displayName = body.displayName.trim();
  if (displayName.length < 1 || displayName.length > 150) {
    return NextResponse.json(
      { error: 'displayName must be between 1 and 150 characters' },
      { status: 400 },
    );
  }

  try {
    await auth.updateUser(uid, { displayName });
  } catch (error) {
    logger.error({
      errorName: error instanceof Error ? error.name : 'UnknownError',
      msg: 'Firebase Auth display name update failed',
    });
    return NextResponse.json(
      { error: 'Unable to update display name. Please retry.' },
      { status: 500 },
    );
  }

  try {
    await syncAdminMember(uid);
  } catch (error) {
    logger.error({
      errorName: error instanceof Error ? error.name : 'UnknownError',
      msg: 'Admin member projection sync failed after display name update',
    });
    return NextResponse.json(
      { error: 'Display name was updated, but profile synchronization failed. Please retry.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, displayName });
}
