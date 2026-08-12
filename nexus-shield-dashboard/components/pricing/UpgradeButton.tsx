'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import type { BillingInterval } from '@/config/pricing';

interface UpgradeButtonProps {
  billingInterval: BillingInterval;
  label?: string;
  className?: string;
}

export function UpgradeButton({
  billingInterval,
  label = 'Upgrade to Pro',
  className = '',
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing_interval: billingInterval }),
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent('/#pricing')}`;
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to start checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      throw new Error('Checkout session did not return a redirect URL');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleUpgrade}
        disabled={loading}
        className={`group inline-flex w-full select-none cursor-pointer items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition-transform hover:scale-[1.02] hover:shadow-fuchsia-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 ${className}`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Zap className="h-4 w-4 transition-transform group-hover:scale-110" />
        )}
        {loading ? 'Redirecting to Checkout…' : label}
      </button>
      {error ? <p className="mt-2 text-center text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}
