'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, Loader2, Unlink, Webhook, XCircle } from 'lucide-react';

export type GithubIntegrationNotice = { type: 'success' | 'error'; message: string } | null;

interface GithubIntegrationCardProps {
  orgId: string;
  installationId: number | null;
  initialNotice?: GithubIntegrationNotice;
}

const GITHUB_APP_SLUG = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;

export function GithubIntegrationCard({ orgId, installationId, initialNotice = null }: GithubIntegrationCardProps) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [notice, setNotice] = useState<GithubIntegrationNotice>(initialNotice);

  async function handleDisconnect() {
    setDisconnecting(true);
    setNotice(null);

    try {
      const response = await fetch('/api/github/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Bağlantı kesilemedi');
      }

      router.refresh();
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'Bir şeyler ters gitti' });
    } finally {
      setDisconnecting(false);
    }
  }

  const installUrl = GITHUB_APP_SLUG
    ? `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new?state=${orgId}`
    : null;

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-zinc-800 p-2 text-zinc-300">
            <Webhook className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-zinc-200">GitHub App Entegrasyonu</h4>
            <p className="mt-1 max-w-sm text-xs text-zinc-500">
              Push ve pull request olaylarında otomatik sızıntı taraması için GitHub App&apos;i bağlayın.
            </p>
          </div>
        </div>

        {installationId ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected (Installation ID: {installationId})
            </span>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-800/80 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-rose-500/30 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
              Disconnect
            </button>
          </div>
        ) : installUrl ? (
          <a
            href={installUrl}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white"
          >
            <Webhook className="h-4 w-4" />
            Connect GitHub App
          </a>
        ) : (
          <span className="text-xs text-amber-400">
            NEXT_PUBLIC_GITHUB_APP_SLUG tanımlı değil — bağlantı linki oluşturulamıyor.
          </span>
        )}
      </div>

      {notice ? (
        <div
          className={`mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
            notice.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-400'
          }`}
        >
          {notice.type === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {notice.message}
        </div>
      ) : null}
    </div>
  );
}
