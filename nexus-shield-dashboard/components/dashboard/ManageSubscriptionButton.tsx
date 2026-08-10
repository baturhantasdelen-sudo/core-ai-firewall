'use client';

import { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';

interface ManageSubscriptionButtonProps {
  orgId: string;
}

export function ManageSubscriptionButton({ orgId }: ManageSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleManageSubscription() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Portal oturumu oluşturulamadı');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Portal oturumu bir yönlendirme adresi döndürmedi');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir şeyler ters gitti');
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleManageSubscription}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {loading ? 'Yönlendiriliyor…' : 'Stripe Portalını Aç'}
      </button>
      {error ? <p className="max-w-[220px] text-right text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}
