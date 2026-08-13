'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface CheckoutSessionVerifierProps {
  sessionId: string;
}

type VerifyState = 'loading' | 'success' | 'error';

export function CheckoutSessionVerifier({ sessionId }: CheckoutSessionVerifierProps) {
  const router = useRouter();
  const [state, setState] = useState<VerifyState>('loading');
  const [message, setMessage] = useState('Confirming your Pro subscription…');

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      try {
        const response = await fetch('/api/stripe/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });

        const data = (await response.json()) as { error?: string; message?: string };

        if (cancelled) return;

        if (!response.ok) {
          setState('error');
          setMessage(data.error ?? 'Could not verify payment. Your plan will update once Stripe confirms.');
          return;
        }

        setState('success');
        setMessage('Pro plan activated successfully!');
        router.refresh();
      } catch {
        if (cancelled) return;
        setState('error');
        setMessage('Could not verify payment. Your plan will update once Stripe confirms.');
      }
    }

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  const isLoading = state === 'loading';
  const isSuccess = state === 'success';

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        isSuccess
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : state === 'error'
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'
      }`}
    >
      <div className="flex items-center gap-2">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSuccess ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : null}
        <span>{message}</span>
      </div>
    </div>
  );
}
