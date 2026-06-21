import { LogIn } from 'lucide-react';
import { signIn } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default function AdminSignIn() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-20">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="font-display text-2xl font-semibold text-text-primary">Admin</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Sign in with the allowlisted Google account to manage episodes and writing.
        </p>
        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/admin' });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 font-display text-sm font-medium text-on-accent transition-opacity hover:opacity-90"
          >
            <LogIn size={16} aria-hidden />
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}
