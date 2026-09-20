import type { Metadata } from 'next';

/** Primary marketing / dashboard web origin — never the API subdomain. */
export const DEFAULT_SITE_URL = 'https://nexusshield.ai';

const ALLOWED_ORIGINS = [
  'https://nexusshield.ai',
  'https://www.nexusshield.ai',
  'https://app.nexusshield.ai',
  'https://api.nexusshield.ai',
  'https://nexus-shield-dashboard.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

/** Relative in-app documentation routes (always served from the web app origin). */
export const APP_DOC_ROUTES = {
  docs: '/docs',
  benchmark: '/docs/benchmark',
  sdk: '/docs#sdk',
} as const;

export const BENCHMARK_GITHUB_URL =
  'https://github.com/nexus-shield/agent-security-benchmark';

function normalizeOrigin(url: string): string {
  return url.replace(/\/$/, '');
}

/** True when hostname is the Shield API host — not valid for marketing/docs links. */
export function isApiSubdomainOrigin(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === 'api.nexusshield.ai' || hostname.startsWith('api.');
  } catch {
    return false;
  }
}

/**
 * Resolve the public web app origin (dashboard/marketing).
 * Falls back to DEFAULT_SITE_URL if NEXT_PUBLIC_APP_URL points at the API subdomain.
 */
export function getSiteUrl(fallbackOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    const normalized = normalizeOrigin(configured);
    if (isApiSubdomainOrigin(normalized)) return DEFAULT_SITE_URL;
    return normalized;
  }

  if (fallbackOrigin) {
    const normalized = normalizeOrigin(fallbackOrigin);
    if (isApiSubdomainOrigin(normalized)) return DEFAULT_SITE_URL;
    return normalized;
  }

  return DEFAULT_SITE_URL;
}

/** Relative app path — use for Next.js Link `href` values. */
export function resolveAppPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/** Absolute web-app URL for canonical metadata, emails, or share links. */
export function getAbsoluteAppUrl(path: string, fallbackOrigin?: string): string {
  return `${getSiteUrl(fallbackOrigin)}${resolveAppPath(path)}`;
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((allowed) => origin === allowed || origin.endsWith('.vercel.app'));
}

export function buildSiteMetadata(origin?: string): Metadata {
  const siteUrl = getSiteUrl(origin);
  const title = 'Nexus Shield — AI Agent Runtime Security & Control Plane';
  const description =
    'The runtime control & trust layer for autonomous AI agents. Real-time Identity → Intent → Action → Proof enforcement with sub-10ms edge validation.';

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: { canonical: siteUrl },
    openGraph: {
      type: 'website',
      url: siteUrl,
      title,
      description,
      siteName: 'Nexus Shield',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}
