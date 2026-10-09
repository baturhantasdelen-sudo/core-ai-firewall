import { isHttpUrlAllowed, parseAllowlistFromEnv } from '@/lib/nexus-core/assurance-engine/http-allowlist';

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 256 * 1024;

export interface HttpReadOptions {
  timeout_ms?: number;
  max_bytes?: number;
}

/** Read-only GET with allowlist, timeout, and size cap. */
export async function httpReadJson(
  url: string,
  options?: HttpReadOptions,
): Promise<{ status: number; body: unknown; content_type: string | null }> {
  const allowed = isHttpUrlAllowed(url, parseAllowlistFromEnv());
  if (!allowed.ok) {
    throw new Error(`HTTP verification blocked: ${allowed.reason}`);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeout_ms ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (res.status >= 300 && res.status < 400) {
      throw new Error('HTTP redirect not followed for verification observer');
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > (options?.max_bytes ?? DEFAULT_MAX_BYTES)) {
      throw new Error('HTTP response exceeds size limit');
    }
    const text = new TextDecoder().decode(buf);
    const contentType = res.headers.get('content-type');
    let body: unknown = text;
    if (contentType?.includes('application/json')) {
      body = JSON.parse(text) as unknown;
    }
    return { status: res.status, body, content_type: contentType };
  } finally {
    clearTimeout(timeout);
  }
}

/** Sync stub — live fetch requires async path; returns error marker for sync engine. */
export function httpReadJsonSyncNotSupported(): never {
  throw new Error('Live HTTP observer requires async verification path or inline_state');
}
