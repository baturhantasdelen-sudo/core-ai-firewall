import { createHash, randomBytes } from 'node:crypto';
import type { Evidence } from '@/lib/nexus-core/outcome/models';

const REDACT_KEYS = /password|secret|token|ssn|pan|cvv|api_key/i;

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(redactSensitive(value)));
}

export function sha256Canonical(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep(record[key]);
        return acc;
      }, {});
  }
  return value;
}

function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(record)) {
      out[key] = REDACT_KEYS.test(key) ? '[REDACTED]' : redactSensitive(val);
    }
    return out;
  }
  return value;
}

function integrityPayload(
  verificationId: string,
  previous_hash: string | null,
  params: Omit<Evidence, 'evidence_id' | 'integrity_hash' | 'previous_hash' | 'verification_id'>,
): Record<string, unknown> {
  return {
    verification_id: verificationId,
    ...params,
    previous_hash,
  };
}

export function computeEvidenceIntegrityHash(
  verificationId: string,
  previous: Evidence | null,
  params: Omit<Evidence, 'evidence_id' | 'integrity_hash' | 'previous_hash' | 'verification_id'>,
): string {
  const previous_hash = previous?.integrity_hash ?? null;
  return sha256Canonical(integrityPayload(verificationId, previous_hash, params));
}

export function appendEvidenceChain(
  verificationId: string,
  previous: Evidence | null,
  params: Omit<Evidence, 'evidence_id' | 'integrity_hash' | 'previous_hash' | 'verification_id'>,
): Evidence {
  const previous_hash = previous?.integrity_hash ?? null;
  const integrity_hash = computeEvidenceIntegrityHash(verificationId, previous, params);
  return {
    evidence_id: `ev_${randomBytes(8).toString('hex')}`,
    verification_id: verificationId,
    ...params,
    previous_hash,
    integrity_hash,
  };
}

export function validateEvidenceChain(evidence: Evidence[]): boolean {
  for (let i = 0; i < evidence.length; i++) {
    const item = evidence[i]!;
    const expectedPrev = i === 0 ? null : evidence[i - 1]!.integrity_hash;
    if (item.previous_hash !== expectedPrev) return false;
    const recomputed = computeEvidenceIntegrityHash(item.verification_id, evidence[i - 1] ?? null, {
      source: item.source,
      source_type: item.source_type,
      resource: item.resource,
      resource_id: item.resource_id,
      observed_state_hash: item.observed_state_hash,
      observed_at: item.observed_at,
      adapter: item.adapter,
      query_fingerprint: item.query_fingerprint,
    });
    if (recomputed !== item.integrity_hash) return false;
  }
  return true;
}
