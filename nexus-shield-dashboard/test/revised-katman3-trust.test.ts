import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  recordOutcomeVerification,
  resetEvidentialVerifierStore,
  verifyActionOutcome,
} from '../lib/engine/evidence/evidential-verifier.ts';
import {
  getDynamicTrustScore,
  getTrustScoreHistory,
  isActionRestricted,
  recalculateDynamicTrustScore,
  resetDynamicTrustScoreStore,
} from '../lib/engine/reputation/dynamic-trust-score.ts';
import {
  generateZkThreatSignature,
  getDigitalImmuneNetworkStats,
  listImmuneNetworkSignatures,
  resetDigitalImmuneStore,
  syncImmuneNetwork,
} from '../lib/engine/threat-intel/digital-immune.ts';
import { resetThreatRegistry } from '../lib/engine/immune/index.ts';
import { listThreatSignatures } from '../lib/engine/immune/registry.ts';

const AGENT_ID = 'revised-katman3-agent';

describe('REVISED Katman 3 — PROVE & TRUST: Evidential, Dynamic Trust & Digital Immune', () => {
  afterEach(() => {
    resetEvidentialVerifierStore();
    resetDynamicTrustScoreStore();
    resetDigitalImmuneStore();
    resetThreatRegistry({ skipSeed: true });
  });

  it('marks financial actions without evidence bundle as UNVERIFIED', () => {
    const result = verifyActionOutcome(
      { toolName: 'stripe_transfer', agentId: AGENT_ID },
      undefined,
    );

    assert.equal(result.verificationStatus, 'UNVERIFIED');
    assert.equal(result.confidenceScore, 0);
    assert.ok(result.missingProofs.includes('TRANSACTION_ID'));
    assert.ok(result.missingProofs.includes('BANK_API_RESPONSE'));
    assert.ok(result.missingProofs.includes('AUTHORIZED_AGENT_SIGNATURE'));
  });

  it('verifies financial actions with complete evidence bundle as VERIFIED', () => {
    const result = verifyActionOutcome(
      { toolName: 'stripe_transfer', agentId: AGENT_ID },
      {
        transactionId: 'TXN-88421-A',
        bankApiResponse: '{"status":"ok","bank_api_response":"payment_confirmed"}',
        authorizedAgentSignature: 'sig_Abc123Xyz789Base64EncodedValueHere==',
      },
    );

    assert.equal(result.verificationStatus, 'VERIFIED');
    assert.ok(result.confidenceScore >= 65);
    assert.equal(result.missingProofs.length, 0);
  });

  it('marks partial evidence as INSUFFICIENT_EVIDENCE with missing proofs listed', () => {
    const result = verifyActionOutcome(
      { toolName: 'bulk_export_db', agentId: AGENT_ID },
      {
        databaseRecordHash: 'sha256:abc123def4567890abcdef1234567890',
      },
    );

    assert.equal(result.verificationStatus, 'INSUFFICIENT_EVIDENCE');
    assert.ok(result.missingProofs.includes('EXECUTION_LOG'));
    assert.ok(result.missingProofs.includes('AUTHORIZED_AGENT_SIGNATURE'));
    assert.ok(result.violations.some((v) => /INSUFFICIENT_EVIDENCE/.test(v)));
  });

  it('records outcome verification logs for dashboard audit trail', () => {
    const result = verifyActionOutcome({ toolName: 'read_invoice', agentId: AGENT_ID });
    recordOutcomeVerification({ toolName: 'read_invoice', agentId: AGENT_ID }, result);
    assert.equal(result.verificationStatus, 'VERIFIED');
  });

  it('recalculates dynamic trust score downward on recent violations', () => {
    const result = recalculateDynamicTrustScore(
      AGENT_ID,
      [
        {
          type: 'TRAJECTORY_CHAIN_VIOLATION',
          severity: 'CRITICAL',
          timestamp: new Date().toISOString(),
        },
        {
          type: 'UNVERIFIED_PAYMENT',
          severity: 'HIGH',
          timestamp: new Date().toISOString(),
        },
      ],
      35,
    );

    assert.ok(result.score < 70);
    assert.ok(['RESTRICTED', 'CRITICAL', 'ELEVATED'].includes(result.tier));
    assert.ok(result.rationale.length > 0);
    assert.ok(result.previousScore === undefined || result.score <= (result.previousScore ?? 100));
  });

  it('applies RESTRICTED tier restrictions: block PAYMENT/EXPORT, WRITE requires approval', () => {
    recalculateDynamicTrustScore(
      AGENT_ID,
      [{ type: 'SUSPICIOUS_EXPORT', severity: 'HIGH', timestamp: new Date().toISOString() }],
      40,
    );

    const trust = getDynamicTrustScore(AGENT_ID);
    assert.ok(trust);
    assert.ok(['RESTRICTED', 'CRITICAL'].includes(trust!.tier));

    if (trust!.tier === 'RESTRICTED') {
      assert.equal(isActionRestricted(AGENT_ID, 'PAYMENT').restricted, true);
      assert.equal(isActionRestricted(AGENT_ID, 'EXPORT').restricted, true);
      assert.equal(isActionRestricted(AGENT_ID, 'WRITE').requiresApproval, true);
    }
  });

  it('freezes agent immediately when trust score drops below 40 (CRITICAL)', () => {
    const result = recalculateDynamicTrustScore(
      AGENT_ID,
      [
        { type: 'DATA_EXFILTRATION', severity: 'CRITICAL', timestamp: new Date().toISOString() },
        { type: 'TRAJECTORY_ESCALATION', severity: 'CRITICAL', timestamp: new Date().toISOString() },
        { type: 'UNVERIFIED_EXPORT', severity: 'CRITICAL', timestamp: new Date().toISOString() },
      ],
      10,
    );

    assert.equal(result.tier, 'CRITICAL');
    assert.ok(result.score < 40);
    assert.ok(result.restrictions.includes('AGENT_FROZEN'));
    assert.equal(isActionRestricted(AGENT_ID, 'PAYMENT').restricted, true);
  });

  it('tracks trust score history for real-time graph rendering', () => {
    recalculateDynamicTrustScore(AGENT_ID, [], 100);
    recalculateDynamicTrustScore(
      AGENT_ID,
      [{ type: 'INTENT_DIVERGENCE', severity: 'MEDIUM', timestamp: new Date().toISOString() }],
      80,
    );

    const history = getTrustScoreHistory(AGENT_ID);
    assert.ok(history.length >= 2);
    assert.ok(history[history.length - 1]!.score <= history[0]!.score);
  });

  it('generates zero-knowledge threat signature in #TS-xxxx format', () => {
    const signature = generateZkThreatSignature({
      sequence: ['read_db', 'call_api', 'write_file'],
      label: 'READ_DB → CALL_API → WRITE_FILE',
      riskLevel: 'CRITICAL',
    });

    assert.match(signature.id, /^#TS-[0-9A-F]{4}$/);
    assert.equal(signature.zeroKnowledge, true);
    assert.ok(signature.anonymizedPattern.length === 3);
    assert.ok(signature.anonymizedPattern.every((step) => step.startsWith('step:')));
    assert.equal(signature.category, 'DATA_EXFILTRATION');
    assert.equal(signature.severity, 'CRITICAL');
  });

  it('syncs ZK signature to immune network with One Customer Learns message', () => {
    const signature = generateZkThreatSignature({
      sequence: ['read_db', 'bulk_export'],
      riskLevel: 'HIGH',
    });

    const sync = syncImmuneNetwork(signature);

    assert.equal(sync.synced, true);
    assert.equal(sync.signatureId, signature.id);
    assert.ok(sync.networkReach >= 1);
    assert.match(sync.message, /One Customer Learns/);

    const network = listImmuneNetworkSignatures();
    assert.ok(network.some((entry) => entry.id === signature.id));

    const stats = getDigitalImmuneNetworkStats();
    assert.ok(stats.totalSignatures >= 1);
  });

  it('registers ZK signature into global immune registry on sync', () => {
    const signature = generateZkThreatSignature({
      sequence: ['read_db', 'call_api', 'write_file'],
      riskLevel: 'CRITICAL',
    });

    syncImmuneNetwork(signature);

    const registry = listThreatSignatures();
    assert.ok(registry.some((entry) => entry.signatureHash === signature.signatureHash));
  });

  it('integrates evidential failure with dynamic trust score drop and immune propagation', () => {
    const outcome = verifyActionOutcome(
      { toolName: 'stripe_transfer', agentId: AGENT_ID },
      undefined,
    );

    assert.equal(outcome.verificationStatus, 'UNVERIFIED');

    const trust = recalculateDynamicTrustScore(
      AGENT_ID,
      [{ type: 'UNVERIFIED_PAYMENT', severity: 'HIGH', timestamp: new Date().toISOString() }],
      20,
    );

    assert.ok(trust.score < 90);

    if (outcome.verificationStatus === 'UNVERIFIED') {
      const signature = generateZkThreatSignature({
        sequence: ['step:financial', 'step:api_call'],
        riskLevel: 'HIGH',
      });
      const sync = syncImmuneNetwork(signature);
      assert.equal(sync.synced, true);
    }
  });
});
