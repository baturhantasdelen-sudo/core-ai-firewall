/**
 * Frontend vs API URL configuration for Nexus Shield dashboard.
 *
 * - NEXT_PUBLIC_APP_URL — dashboard / marketing origin (e.g. https://nexusshield.ai)
 *   Must NOT be https://api.nexusshield.ai — use relative paths (/docs/benchmark) or getAbsoluteAppUrl().
 * - NEXT_PUBLIC_API_URL — external Shield FastAPI (e.g. https://api.nexusshield.ai) — server/API only
 * - NEXT_PUBLIC_REPORT_API_URL — optional override for dashboard-hosted /api/reports/* routes
 */

import { getApiBaseUrl } from '@/lib/api-config';
import { getAbsoluteAppUrl, getSiteUrl, resolveAppPath } from '@/lib/site';

export function getAppBaseUrl(fallbackOrigin?: string): string {
  return getSiteUrl(fallbackOrigin);
}

export function getShieldApiBaseUrl(): string {
  return getApiBaseUrl();
}

/**
 * Base URL for dashboard-hosted report API routes (PDF export, etc.).
 * These run on the Next.js app — not the external FastAPI shield host.
 */
export function getReportApiBaseUrl(fallbackOrigin?: string): string {
  return (
    process.env.NEXT_PUBLIC_REPORT_API_URL?.replace(/\/$/, '') ??
    getAppBaseUrl(fallbackOrigin)
  );
}

export function getResearchReportPdfUrl(fallbackOrigin?: string): string {
  return `${getReportApiBaseUrl(fallbackOrigin)}/api/reports/state-of-agent-security-2026/pdf`;
}

/** Documentation pages — always on the web app origin, never the API subdomain. */
export function getWebDocUrl(path: string, fallbackOrigin?: string): string {
  return getAbsoluteAppUrl(resolveAppPath(path), fallbackOrigin);
}

export const publicConfig = {
  appUrl: getAppBaseUrl(),
  apiUrl: getShieldApiBaseUrl(),
  reportApiUrl: getReportApiBaseUrl(),
  researchReportPdfUrl: getResearchReportPdfUrl(),
} as const;
