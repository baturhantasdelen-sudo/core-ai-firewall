'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { BrandLogo } from '@/components/brand/BrandLogo';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState<'google' | 'github' | 'email' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function oauth(provider: 'google' | 'github') {
    setLoading(provider);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      if (authError) throw authError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth sign-in failed');
      setLoading(null);
    }
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading('email');
    setError(null);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      if (authError) throw authError;
      setMessage('Check your email for a secure sign-in link.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email sign-in failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/70 p-8 backdrop-blur-sm">
      <div className="mb-8 flex justify-center">
        <BrandLogo size={44} />
      </div>
      <h1 className="select-none text-center text-2xl font-semibold text-zinc-100">Sign in to Nexus Shield</h1>
      <p className="mt-2 select-none text-center text-sm text-zinc-500">
        Google, GitHub, or email — 50 free scans on the Free tier.
      </p>

      <div className="mt-8 space-y-3">
        <button
          type="button"
          onClick={() => void oauth('google')}
          disabled={loading !== null}
          className="flex w-full select-none cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-zinc-800/80 px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 disabled:opacity-60"
        >
          {loading === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => void oauth('github')}
          disabled={loading !== null}
          className="flex w-full select-none cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 bg-zinc-800/80 px-4 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 disabled:opacity-60"
        >
          {loading === 'github' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Continue with GitHub
        </button>
      </div>

      <form onSubmit={magicLink} className="mt-6 space-y-3">
        <label htmlFor="email" className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Email
        </label>
        <div className="flex gap-2">
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="flex-1 rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading !== null}
            className="inline-flex select-none cursor-pointer items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
          >
            {loading === 'email' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          </button>
        </div>
      </form>

      {message ? <p className="mt-4 text-center text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="mt-4 text-center text-sm text-rose-400">{error}</p> : null}

      <p className="mt-8 select-none text-center text-xs text-zinc-600">
        <Link href="/" className="cursor-pointer text-indigo-400 hover:text-indigo-300">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
