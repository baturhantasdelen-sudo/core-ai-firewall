/** Canonical backend API base URL for server and client usage. */

const DEFAULT_API_URL = 'https://api.nexusshield.ai';

export function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ??
    process.env.NEXUS_SHIELD_API_URL?.replace(/\/$/, '') ??
    DEFAULT_API_URL
  );
}

export function getShieldApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}
