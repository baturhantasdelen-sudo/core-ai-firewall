import type { Metadata } from 'next';

const DEFAULT_SITE_URL = 'https://nexusshield.ai';

const ALLOWED_ORIGINS = [
  'https://nexusshield.ai',
  'https://www.nexusshield.ai',
  'https://app.nexusshield.ai',
  'https://api.nexusshield.ai',
  'https://nexus-shield-dashboard.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];

export function getSiteUrl(fallbackOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, '');
  return DEFAULT_SITE_URL;
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((allowed) => origin === allowed || origin.endsWith('.vercel.app'));
}

export function buildSiteMetadata(origin?: string): Metadata {
  const siteUrl = getSiteUrl(origin);
  const title = 'Nexus Shield — AI PII Firewall, Prompt Injection Guard & DevSecOps';
  const description =
    'Production-ready AI security SaaS: live PII masking, sub-10ms guardrails, KVKK/GDPR compliance, Stripe billing, and CI/CD secret scanning.';

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
