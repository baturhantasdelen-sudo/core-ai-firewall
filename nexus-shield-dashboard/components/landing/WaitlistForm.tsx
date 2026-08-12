'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Check, Loader2 } from 'lucide-react';

type SubmitState = 'idle' | 'loading' | 'success' | 'error';

export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('loading');
    setMessage(null);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Something went wrong.');
      }

      setState('success');
      setMessage(data.alreadyJoined ? "You're already on the list!" : "You're on the list!");
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    }
  }

  if (state === 'success') {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3.5 text-sm font-medium text-emerald-400">
        <Check className="h-4 w-4 shrink-0" />
        {message}
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className="w-full flex-1 rounded-lg border border-white/10 bg-zinc-950/60 px-4 py-3.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {state === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Join Waitlist
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {state === 'error' && message ? <p className="mt-2 text-xs text-rose-400">{message}</p> : null}
    </div>
  );
}
