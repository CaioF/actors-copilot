'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface AdminLoginFormProps {
  navigate?: (path: string) => void;
}

export function AdminLoginForm({
  navigate = (path) => window.location.assign(path),
}: AdminLoginFormProps = {}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') ?? '');
    const password = String(form.get('password') ?? '');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        navigate('/admin-dashboard');
        return;
      }

      setError(
        response.status === 429
          ? 'Too many attempts. Please wait and try again.'
          : 'Unable to log in with those credentials.',
      );
    } catch {
      setError('Unable to log in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F1E8] px-4 py-12">
      <Card className="w-full max-w-md border-[#3D4A3C]/15 bg-white shadow-lg shadow-[#3D4A3C]/5">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E8721A]">
            Internal operator
          </p>
          <CardTitle className="font-[family-name:var(--font-antonio)] text-3xl text-[#3D4A3C]">
            <h1>Admin access</h1>
          </CardTitle>
          <CardDescription>
            Sign in to view the member reporting dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#3D4A3C]" htmlFor="admin-username">
                Username
              </label>
              <Input
                autoComplete="username"
                disabled={isSubmitting}
                id="admin-username"
                name="username"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#3D4A3C]" htmlFor="admin-password">
                Password
              </label>
              <Input
                autoComplete="current-password"
                disabled={isSubmitting}
                id="admin-password"
                name="password"
                required
                type="password"
              />
            </div>
            <div
              aria-live="polite"
              className="min-h-5 text-sm text-red-700"
              role={error ? 'alert' : undefined}
            >
              {error}
            </div>
            <Button
              className="w-full bg-[#3D4A3C] text-white hover:bg-[#303B30]"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Logging in...' : 'Log in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
