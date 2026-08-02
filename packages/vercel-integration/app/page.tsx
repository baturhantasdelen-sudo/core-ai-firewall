import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import SetupClient from './setup-client';

export const metadata: Metadata = {
  title: 'Nexus Shield · Vercel Integration',
  description: 'Connect Nexus Shield to your Vercel project in one click.',
};

export default function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ configurationId?: string; teamId?: string }>;
}) {
  return <SetupPageInner searchParams={searchParams} />;
}

async function SetupPageInner({
  searchParams,
}: {
  searchParams: Promise<{ configurationId?: string; teamId?: string }>;
}) {
  const params = await searchParams;

  return (
    <main style={styles.main}>
      <section style={styles.card}>
        <div style={styles.badge}>Vercel Marketplace Integration</div>
        <h1 style={styles.title}>Nexus Shield Setup</h1>
        <p style={styles.subtitle}>
          Select a Vercel project to inject Nexus Shield environment variables automatically.
        </p>

        {params.configurationId ? (
          <p style={styles.meta}>
            Installation: <code>{params.configurationId}</code>
            {params.teamId ? (
              <>
                {' '}
                · Team: <code>{params.teamId}</code>
              </>
            ) : null}
          </p>
        ) : (
          <p style={styles.meta}>
            Install this integration from the Vercel Marketplace to begin OAuth setup.
          </p>
        )}

        <SetupClient teamId={params.teamId} />
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    background: '#0b0f19',
    color: '#e2e8f0',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 640,
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 16,
    padding: 28,
  },
  badge: {
    display: 'inline-block',
    marginBottom: 12,
    padding: '6px 10px',
    borderRadius: 999,
    background: 'rgba(99, 102, 241, 0.15)',
    color: '#c7d2fe',
    fontSize: 12,
  },
  title: {
    margin: '0 0 8px',
    fontSize: 28,
  },
  subtitle: {
    margin: '0 0 16px',
    color: '#94a3b8',
    lineHeight: 1.6,
  },
  meta: {
    margin: '0 0 20px',
    color: '#94a3b8',
    fontSize: 14,
  },
};
