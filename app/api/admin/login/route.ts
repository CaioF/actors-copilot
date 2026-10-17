import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { setAdminSession, verifyAdminCredentials } from '@/lib/admin-dashboard/session';

const FAILURE_LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

interface FailedAttemptWindow {
  count: number;
  startedAt: number;
}

// Best-effort protection for this low-volume tool; serverless cold starts reset the map.
const failedAttempts = new Map<string, FailedAttemptWindow>();

function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown').toLowerCase();
}

function getActiveWindow(key: string, now: number): FailedAttemptWindow | null {
  const window = failedAttempts.get(key);
  if (!window || now - window.startedAt >= WINDOW_MS) {
    failedAttempts.delete(key);
    return null;
  }
  return window;
}

function recordFailure(key: string, now: number): void {
  const window = getActiveWindow(key, now);
  failedAttempts.set(key, window
    ? { ...window, count: window.count + 1 }
    : { count: 1, startedAt: now });
}

function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return errorResponse('Invalid request', 400);
  }

  const origin = request.headers.get('origin');
  // Origin-less requests are accepted for non-browser clients.
  if (origin && origin !== new URL(request.url).origin) {
    return errorResponse('Invalid request', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid request', 400);
  }

  if (
    typeof body !== 'object'
    || body === null
    || typeof (body as Record<string, unknown>).username !== 'string'
    || typeof (body as Record<string, unknown>).password !== 'string'
  ) {
    return errorResponse('Invalid request', 400);
  }

  const key = getClientKey(request);
  const now = Date.now();
  if ((getActiveWindow(key, now)?.count ?? 0) >= FAILURE_LIMIT) {
    return errorResponse('Too many attempts', 429);
  }

  const { username, password } = body as { username: string; password: string };

  try {
    if (!verifyAdminCredentials(username, password)) {
      recordFailure(key, now);
      return errorResponse('Invalid credentials', 401);
    }

    failedAttempts.delete(key);
    await setAdminSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({
      route: '/api/admin/login',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    }, 'Admin login failed');
    return errorResponse('Unable to log in', 500);
  }
}
