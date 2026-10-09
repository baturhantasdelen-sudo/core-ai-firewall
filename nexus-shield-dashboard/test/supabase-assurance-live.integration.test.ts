/**
 * LIVE Supabase integration — runs only when explicitly enabled.
 * Set NEXUS_ASSURANCE_LIVE_INTEGRATION=true plus Supabase credentials and applied migrations.
 * Does not print secrets. Does not use customer financial data.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it, before, after } from 'node:test';
import { isSupabaseLiveIntegrationEnabled } from '@/lib/nexus-core/assurance-persistence/config';
import { getSupabaseAdmin } from '@/lib/supabase';
import { demoFinanceVerified } from '@/lib/nexus-core/assurance-engine/demo-scenarios';
import {
  resetAssuranceBootstrapForTests,
  runOutcomeVerificationForOrganization,
} from '@/lib/nexus-core/outcome/org-verify';
import { loadVerificationProof } from '@/lib/nexus-core/proof/verification-proof';
import { resetSupabaseAssurancePersistenceForTests } from '@/lib/nexus-core/assurance-persistence/supabase';
import { resetAssurancePersistenceForTests } from '@/lib/nexus-core/assurance-persistence';

const LIVE = isSupabaseLiveIntegrationEnabled();

describe('Supabase LIVE integration', { skip: !LIVE }, () => {
  let orgA: string;
  let orgB: string;
  let apiKeyA: string;

  before(async () => {
    process.env.NEXUS_ASSURANCE_USE_SUPABASE = 'true';
    resetAssuranceBootstrapForTests();
    resetAssurancePersistenceForTests();
    resetSupabaseAssurancePersistenceForTests();
    const supabase = getSupabaseAdmin();
    apiKeyA = `nex_live_${randomBytes(8).toString('hex')}`;
    const apiKeyB = `nex_live_${randomBytes(8).toString('hex')}`;
    const { data: a, error: e1 } = await supabase
      .from('organizations')
      .insert({ name: 'assurance-live-a', api_key: apiKeyA })
      .select('id')
      .single();
    const { data: b, error: e2 } = await supabase
      .from('organizations')
      .insert({ name: 'assurance-live-b', api_key: apiKeyB })
      .select('id')
      .single();
    if (e1 || e2 || !a?.id || !b?.id) {
      throw new Error('Failed to create synthetic test organizations (apply schema-assurance migrations)');
    }
    orgA = a.id;
    orgB = b.id;
  });

  after(async () => {
    if (!orgA) return;
    const supabase = getSupabaseAdmin();
    await supabase.from('organizations').delete().eq('id', orgA);
    if (orgB) await supabase.from('organizations').delete().eq('id', orgB);
  });

  it('connectivity — organizations readable', async () => {
    const { error } = await getSupabaseAdmin().from('organizations').select('id').limit(1);
    assert.equal(error, null);
  });

  it('persists verification bundle via RPC and loads proof', async () => {
    const req = { ...demoFinanceVerified(), idempotency_key: `live-${randomBytes(4).toString('hex')}` };
    const result = await runOutcomeVerificationForOrganization(orgA, req);
    assert.equal(result.status, 'VERIFIED');
    const proof = await loadVerificationProof(orgA, result.verification_id);
    assert.ok(proof);
    assert.equal(proof.verification_status, 'VERIFIED');
    assert.ok(proof.evidence_ids.length >= 1);
    assert.equal(proof.hash_chain_valid, true);
  });

  it('denies cross-tenant proof load (IDOR)', async () => {
    const req = demoFinanceVerified();
    const result = await runOutcomeVerificationForOrganization(orgA, req);
    const proof = await loadVerificationProof(orgB, result.verification_id);
    assert.equal(proof, null);
  });

  it('idempotency replay stable', async () => {
    const key = `idem-live-${randomBytes(4).toString('hex')}`;
    const req = { ...demoFinanceVerified(), idempotency_key: key };
    const a = await runOutcomeVerificationForOrganization(orgA, req);
    const b = await runOutcomeVerificationForOrganization(orgA, req);
    assert.equal(a.verification_id, b.verification_id);
  });
});

describe('Supabase LIVE integration gate', () => {
  it('reports BLOCKED when live flag unset', () => {
    if (process.env.NEXUS_ASSURANCE_LIVE_INTEGRATION === 'true') return;
    assert.equal(isSupabaseLiveIntegrationEnabled(), false);
  });
});
