'use client';

import { useState } from 'react';
import { Loader2, Zap } from 'lucide-react';

interface UpgradeButtonProps {
  orgId: string;
}

export function UpgradeButton({ orgId }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to start checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Checkout session did not return a redirect URL');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleUpgrade}
        disabled={loading}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition-transform hover:scale-[1.02] hover:shadow-fuchsia-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4 transition-transform group-hover:scale-110" />
        )}
        {loading ? 'Redirecting to Checkout…' : 'Upgrade to Pro ($79/mo)'}
      </button>
      {error ? <p className="mt-2 text-center text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}
