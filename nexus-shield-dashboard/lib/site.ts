import type { Metadata } from 'next';

/** Canonical marketing origin once DNS is configured at Cloudflare. */
export const PRIMARY_SITE_URL = 'https://nexusshield.ai';

/** Alternate canonical host (redirect handled by Vercel domain settings). */
export const WWW_SITE_URL = 'https://www.nexusshield.ai';

/**
 * Live Vercel deployment — use until apex/www DNS records exist.
 * Verified: https://nexus-shield-dashboard.vercel.app/docs/benchmark → 200 OK
 */
export const DEPLOYMENT_FALLBACK_URL = 'https://nexus-shield-dashboard.vercel.app';

/** @deprecated Use PRIMARY_SITE_URL */
export const DEFAULT_SITE_URL = PRIMARY_SITE_URL;

const ALLOWED_ORIGINS = [
  PRIMARY_SITE_URL,
  WWW_SITE_URL,
  'https://app.nexusshield.ai',
  'https://api.nexusshield.ai',
  DEPLOYMENT_FALLBACK_URL,
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

function originFromHost(host: string): string {
  return normalizeOrigin(`https://${host.split(':')[0]}`);
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

function isLocalOrigin(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Resolve the public web app origin (dashboard/marketing).
 *
 * Priority:
 * 1. NEXT_PUBLIC_APP_URL (unless API subdomain)
 * 2. Request/fallback origin (when the browser reached a valid host)
 * 3. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL (runtime on Vercel)
 * 4. DEPLOYMENT_FALLBACK_URL (known-good until apex DNS is configured)
 */
export function getSiteUrl(fallbackOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    const normalized = normalizeOrigin(configured);
    if (isApiSubdomainOrigin(normalized)) return DEPLOYMENT_FALLBACK_URL;
    return normalized;
  }

  if (fallbackOrigin) {
    const normalized = normalizeOrigin(fallbackOrigin);
    if (isApiSubdomainOrigin(normalized)) return DEPLOYMENT_FALLBACK_URL;
    if (isLocalOrigin(normalized)) return normalized;
    return normalized;
  }

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) {
    return originFromHost(vercelProduction);
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return originFromHost(vercelUrl);
  }

  return DEPLOYMENT_FALLBACK_URL;
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
