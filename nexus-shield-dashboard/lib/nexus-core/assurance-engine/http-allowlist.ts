/** SSRF-safe HTTP read allowlist for GenericHttpOutcomeAdapter. */

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|0\.0\.0\.0|\[::1\])/i;

export function parseAllowlistFromEnv(): Set<string> {
  const raw = process.env.NEXUS_HTTP_VERIFY_ALLOWLIST ?? '';
  const hosts = raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return new Set(hosts);
}

export function isHttpUrlAllowed(url: string, allowlist: Set<string>): { ok: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'invalid URL' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'protocol not allowed' };
  }
  if (process.env.NEXUS_HTTP_ALLOW_INSECURE !== 'true' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'HTTPS required' };
  }
  const host = parsed.hostname.toLowerCase();
  if (PRIVATE_HOST.test(host) && process.env.NEXUS_HTTP_ALLOW_PRIVATE !== 'true') {
    return { ok: false, reason: 'private/localhost blocked' };
  }
  if (allowlist.size === 0) {
    return { ok: false, reason: 'no allowlist configured' };
  }
  if (!allowlist.has(host)) {
    return { ok: false, reason: 'host not in allowlist' };
  }
  return { ok: true };
}
