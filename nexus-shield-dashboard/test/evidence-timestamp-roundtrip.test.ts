/**
 * Offline: Supabase TIMESTAMPTZ round-trip vs evidence integrity hash (read normalization).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { normalizeObservedAtForEvidenceRead } from '@/lib/nexus-core/assurance-persistence/supabase';
import {
  appendEvidenceChain,
  computeEvidenceIntegrityHash,
  validateEvidenceChain,
} from '@/lib/nexus-core/outcome/evidence';
import type { Evidence } from '@/lib/nexus-core/outcome/models';

const VERIFICATION_ID = 'ov_offline_roundtrip_diagnosis';

function simulatePostgrestTimestamptzString(engineIso: string): string {
  const d = new Date(engineIso);
  if (Number.isNaN(d.getTime())) return engineIso;
  return d.toISOString().replace('Z', '+00:00');
}

function simulatePostgrestWithoutFractionalSeconds(engineIso: string): string {
  const d = new Date(engineIso);
  if (Number.isNaN(d.getTime())) return engineIso;
  return d.toISOString().replace(/\.\d{3}Z$/, '+00:00').replace('Z', '+00:00');
}

function reloadEvidenceWithNormalizedObservedAt(evidence: Evidence, rawObservedAt: unknown): Evidence {
  return {
    ...evidence,
    observed_at: normalizeObservedAtForEvidenceRead(rawObservedAt),
  };
}

describe('evidence integrity hash — serialization inputs', () => {
  it('hashes verification_id, chain fields, and observed_at via canonical JSON', () => {
    const ev = appendEvidenceChain(VERIFICATION_ID, null, {
      source: 'mock',
      source_type: 'fixture',
      resource: 'ledger',
      resource_id: 'INV-OFFLINE',
      observed_state_hash: 'sha256:deadbeef',
      observed_at: '2026-04-09T12:00:00.000Z',
      adapter: 'mock',
      query_fingerprint: 'mock:offline',
    });

    const recomputed = computeEvidenceIntegrityHash(VERIFICATION_ID, null, {
      source: ev.source,
      source_type: ev.source_type,
      resource: ev.resource,
      resource_id: ev.resource_id,
      observed_state_hash: ev.observed_state_hash,
      observed_at: ev.observed_at,
      adapter: ev.adapter,
      query_fingerprint: ev.query_fingerprint,
    });
    assert.equal(recomputed, ev.integrity_hash);
    assert.equal(validateEvidenceChain([ev]), true);
  });
});

describe('evidence TIMESTAMPTZ read normalization', () => {
  it('engine evidence validates before Supabase-shaped read', () => {
    const engineObservedAt = new Date('2026-04-09T12:34:56.789Z').toISOString();
    const ev = appendEvidenceChain(VERIFICATION_ID, null, {
      source: 'mock',
      source_type: 'fixture',
      resource: 'ledger',
      resource_id: 'INV-3001',
      observed_state_hash: 'sha256:abc123',
      observed_at: engineObservedAt,
      adapter: 'mock',
      query_fingerprint: 'mock:finance_verified_refund',
    });
    assert.equal(validateEvidenceChain([ev]), true);
  });

  it('PostgREST +00:00 observed_at validates after normalization (lossless instant)', () => {
    const engineObservedAt = new Date('2026-04-09T12:34:56.789Z').toISOString();
    const ev = appendEvidenceChain(VERIFICATION_ID, null, {
      source: 'mock',
      source_type: 'fixture',
      resource: 'ledger',
      resource_id: 'INV-3001',
      observed_state_hash: 'sha256:abc123',
      observed_at: engineObservedAt,
      adapter: 'mock',
      query_fingerprint: 'mock:finance_verified_refund',
    });

    const postgrestObservedAt = simulatePostgrestTimestamptzString(engineObservedAt);
    assert.notEqual(postgrestObservedAt, engineObservedAt);

    const reloaded = reloadEvidenceWithNormalizedObservedAt(ev, postgrestObservedAt);
    assert.equal(reloaded.observed_at, engineObservedAt);
    assert.equal(validateEvidenceChain([reloaded]), true);
  });

  it('fraction-stripped timestamptz fails chain validation (precision loss)', () => {
    const engineObservedAt = new Date('2026-04-09T12:34:56.789Z').toISOString();
    const ev = appendEvidenceChain(VERIFICATION_ID, null, {
      source: 'mock',
      source_type: 'fixture',
      resource: 'ledger',
      resource_id: 'INV-3001',
      observed_state_hash: 'sha256:abc123',
      observed_at: engineObservedAt,
      adapter: 'mock',
      query_fingerprint: 'mock:finance_verified_refund',
    });

    const stripped = simulatePostgrestWithoutFractionalSeconds(engineObservedAt);
    const reloaded = reloadEvidenceWithNormalizedObservedAt(ev, stripped);
    assert.notEqual(reloaded.observed_at, engineObservedAt);
    assert.equal(validateEvidenceChain([reloaded]), false);
  });

  it('rejects invalid observed_at on read', () => {
    assert.throws(() => normalizeObservedAtForEvidenceRead('not-a-timestamp'), /invalid/);
    assert.throws(() => normalizeObservedAtForEvidenceRead(''), /empty/);
  });

  it('broken previous_hash still fails validation after normalization', () => {
    const engineObservedAt = new Date('2026-04-09T12:34:56.789Z').toISOString();
    const ev = appendEvidenceChain(VERIFICATION_ID, null, {
      source: 'mock',
      source_type: 'fixture',
      resource: 'ledger',
      resource_id: 'INV-3001',
      observed_state_hash: 'sha256:abc123',
      observed_at: engineObservedAt,
      adapter: 'mock',
      query_fingerprint: 'mock:finance_verified_refund',
    });

    const postgrestObservedAt = simulatePostgrestTimestamptzString(engineObservedAt);
    const reloaded = reloadEvidenceWithNormalizedObservedAt(ev, postgrestObservedAt);
    const tampered = { ...reloaded, previous_hash: 'sha256:tampered' };
    assert.equal(validateEvidenceChain([tampered]), false);
  });

  it('tampered integrity_hash still fails validation', () => {
    const engineObservedAt = new Date('2026-04-09T12:34:56.789Z').toISOString();
    const ev = appendEvidenceChain(VERIFICATION_ID, null, {
      source: 'mock',
      source_type: 'fixture',
      resource: 'ledger',
      resource_id: 'INV-3001',
      observed_state_hash: 'sha256:abc123',
      observed_at: engineObservedAt,
      adapter: 'mock',
      query_fingerprint: 'mock:finance_verified_refund',
    });

    const reloaded = reloadEvidenceWithNormalizedObservedAt(
      ev,
      simulatePostgrestTimestamptzString(engineObservedAt),
    );
    const tampered = { ...reloaded, integrity_hash: 'sha256:deadbeef0000000000000000000000000000000000000000000000000000' };
    assert.equal(validateEvidenceChain([tampered]), false);
  });
});

describe('Supabase getEvidence ordering (static)', () => {
  it('orders by created_at then evidence_id and re-sorts by hash chain', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/nexus-core/assurance-persistence/supabase.ts'),
      'utf8',
    );
    const getEvidenceBlock = src.slice(src.indexOf('async getEvidence'), src.indexOf('async getUar'));
    assert.match(getEvidenceBlock, /\.order\s*\(\s*['"]created_at['"]/);
    assert.match(getEvidenceBlock, /\.order\s*\(\s*['"]evidence_id['"]/);
    assert.match(getEvidenceBlock, /sortEvidenceByHashChain/);
  });
});
