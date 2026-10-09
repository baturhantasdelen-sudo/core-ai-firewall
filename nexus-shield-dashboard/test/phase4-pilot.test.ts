import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { enrichRequestWithFinanceErpObservation } from '@/lib/nexus-core/outcome/finance-erp-async';
import { defaultVerificationPlan } from '@/lib/nexus-core/outcome/verifier';
import { useSupabaseAssurancePersistence } from '@/lib/nexus-core/assurance-persistence/supabase';
import { initAssurancePersistence, resetAssurancePersistenceForTests } from '@/lib/nexus-core/assurance-persistence';
import { runAssuranceEngine } from '@/lib/nexus-core/assurance-engine/engine';
import { demoFinanceWrongAmount } from '@/lib/nexus-core/assurance-engine/demo-scenarios';
import { buildVerificationRequestFingerprint } from '@/lib/nexus-core/assurance-persistence/fingerprint';
import { deriveRecordProvenance } from '@/lib/nexus-core/assurance-persistence/provenance';
import { persistVerificationAsync } from '@/lib/nexus-core/outcome/persist-async';
import { clearVerificationStoreForTests } from '@/lib/nexus-core/outcome/store';

describe('Phase 4 — Finance ERP async observer', () => {
  const prev = process.env.NEXUS_FINANCE_ERP_INLINE_FIXTURE;

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXUS_FINANCE_ERP_INLINE_FIXTURE;
    else process.env.NEXUS_FINANCE_ERP_INLINE_FIXTURE = prev;
  });

  it('uses inline fixture without live network', async () => {
    process.env.NEXUS_FINANCE_ERP_INLINE_FIXTURE = JSON.stringify({
      invoice_id: 'INV-PILOT',
      status: 'PENDING',
      refund_amount: 500000,
      currency: 'TRY',
    });
    const req = {
      agent_id: 'a',
      action_id: 'act',
      expected_outcome: {
        outcome_id: 'o',
        action_id: 'act',
        type: 'refund',
        expected_state: { refund_amount: 50000, status: 'REFUNDED' },
      },
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'finance_erp_http' as const,
      resource_id: 'INV-PILOT',
      tool_response: { status_code: 200, body: 'success' },
    };
    const enriched = await enrichRequestWithFinanceErpObservation(req);
    assert.ok(enriched.observed_state_override);
    assert.equal(enriched.observed_state_override?.status, 'PENDING');
  });

  it('live path blocked without configuration', async () => {
    delete process.env.NEXUS_FINANCE_ERP_INLINE_FIXTURE;
    delete process.env.NEXUS_FINANCE_ERP_LIVE_TEST;
    const req = {
      agent_id: 'a',
      action_id: 'act',
      expected_outcome: {
        outcome_id: 'o',
        action_id: 'act',
        type: 'refund',
        expected_state: { status: 'REFUNDED' },
      },
      verification_plan: defaultVerificationPlan(),
      adapter_id: 'finance_erp_http' as const,
      resource_id: 'INV-1',
    };
    await assert.rejects(() => enrichRequestWithFinanceErpObservation(req), /BLOCKED BY CONFIGURATION/);
  });
});

describe('Phase 4 — false success pilot scenario (deterministic)', () => {
  beforeEach(() => {
    clearVerificationStoreForTests();
    resetAssurancePersistenceForTests();
    initAssurancePersistence({ mode: 'memory' });
  });

  it('agent success + wrong ERP amount → FAILED + false_success', async () => {
    const req = demoFinanceWrongAmount();
    const scope = {
      org_id: '11111111-1111-1111-1111-111111111111',
      agent_id: req.agent_id,
      action_id: req.action_id,
      adapter_id: req.adapter_id,
      mock_fixture: req.mock_fixture,
      record_provenance: deriveRecordProvenance(req),
      request_fingerprint: buildVerificationRequestFingerprint(req),
    };
    const result = runAssuranceEngine(req, scope);
    const persisted = await persistVerificationAsync(scope, result);
    assert.equal(persisted.status, 'FAILED');
    assert.equal(persisted.false_success_detected, true);
  });
});

describe('Phase 4 — Supabase integration gate', () => {
  it('reports unverified when Supabase not configured in test', () => {
    assert.equal(useSupabaseAssurancePersistence(), false);
  });
});
