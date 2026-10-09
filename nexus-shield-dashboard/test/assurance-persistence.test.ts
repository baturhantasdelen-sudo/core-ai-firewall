import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { runAssuranceEngine } from '@/lib/nexus-core/assurance-engine/engine';
import { demoFinanceVerified, demoFinanceWrongAmount } from '@/lib/nexus-core/assurance-engine/demo-scenarios';
import {
  initAssurancePersistence,
  reopenSqlitePersistence,
  resetAssurancePersistenceForTests,
  type PersistScope,
} from '@/lib/nexus-core/assurance-persistence';
import { buildVerificationRequestFingerprint } from '@/lib/nexus-core/assurance-persistence/fingerprint';
import { deriveRecordProvenance } from '@/lib/nexus-core/assurance-persistence/provenance';
import { IdempotencyConflictError } from '@/lib/nexus-core/assurance-persistence/types';
import { getVerificationResult, getVerificationUar } from '@/lib/nexus-core/outcome/store';
import { clearVerificationStoreForTests } from '@/lib/nexus-core/outcome/store';
import { loadVerificationProof } from '@/lib/nexus-core/proof/verification-proof';
import { isFinanceErpLiveConfigured } from '@/lib/nexus-core/adapters/finance-erp-http';
import { readFileSync } from 'node:fs';

const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_B = '22222222-2222-2222-2222-222222222222';

function scope(org_id: string, req: ReturnType<typeof demoFinanceVerified>): PersistScope {
  return {
    org_id,
    agent_id: req.agent_id,
    action_id: req.action_id,
    adapter_id: req.adapter_id,
    mock_fixture: req.mock_fixture,
    record_provenance: deriveRecordProvenance(req),
    request_fingerprint: buildVerificationRequestFingerprint(req),
  };
}

describe('Assurance persistence — sqlite durability', () => {
  let dir: string;
  let dbPath: string;

  beforeEach(() => {
    clearVerificationStoreForTests();
    dir = mkdtempSync(join(tmpdir(), 'nexus-assurance-'));
    dbPath = join(dir, 'test.sqlite');
    initAssurancePersistence({ sqlitePath: dbPath });
  });

  afterEach(() => {
    resetAssurancePersistenceForTests();
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      /* Windows file lock — best effort cleanup */
    }
  });

  it('survives process restart (reopen database)', () => {
    const req = demoFinanceVerified();
    const result = runAssuranceEngine(req, scope(ORG_A, req));
    assert.equal(result.status, 'VERIFIED');

    reopenSqlitePersistence();
    const loaded = getVerificationResult(result.verification_id, ORG_A);
    assert.ok(loaded);
    assert.equal(loaded.status, 'VERIFIED');
    assert.ok(getVerificationUar(result.verification_id, ORG_A));
  });

  it('denies cross-tenant read (IDOR)', async () => {
    const req = demoFinanceVerified();
    const result = runAssuranceEngine(req, scope(ORG_A, req));
    assert.equal(getVerificationResult(result.verification_id, ORG_B), undefined);
    assert.equal(await loadVerificationProof(ORG_B, result.verification_id), null);
  });

  it('durable idempotency replay', () => {
    const req = { ...demoFinanceVerified(), idempotency_key: 'k1' };
    const s = scope(ORG_A, req);
    const a = runAssuranceEngine(req, s);
    reopenSqlitePersistence();
    const b = runAssuranceEngine(req, s);
    assert.equal(a.verification_id, b.verification_id);
  });

  it('rejects idempotency key with conflicting payload', () => {
    const base = { ...demoFinanceVerified(), idempotency_key: 'k-conflict' };
    runAssuranceEngine(base, scope(ORG_A, base));
    const other = demoFinanceWrongAmount();
    assert.throws(
      () =>
        runAssuranceEngine(
          { ...other, idempotency_key: 'k-conflict' },
          { ...scope(ORG_A, other), request_fingerprint: 'different-fingerprint' },
        ),
      IdempotencyConflictError,
    );
  });

  it('classifies mock fixtures as DEMO provenance', async () => {
    const req = demoFinanceVerified();
    const result = runAssuranceEngine(req, scope(ORG_A, req));
    const proof = await loadVerificationProof(ORG_A, result.verification_id);
    assert.equal(proof?.record_type, 'DEMO');
  });
});

describe('Assurance schema migration file', () => {
  it('defines core assurance tables', () => {
    const sql = readFileSync(join(process.cwd(), 'schema-assurance.sql'), 'utf8');
    assert.match(sql, /assurance_verifications/);
    assert.match(sql, /assurance_evidence/);
    assert.match(sql, /assurance_uar/);
    assert.match(sql, /assurance_idempotency/);
  });
});

describe('Finance ERP live validation gate', () => {
  it('live sandbox test blocked when not configured', () => {
    assert.equal(isFinanceErpLiveConfigured(), false);
  });
});
