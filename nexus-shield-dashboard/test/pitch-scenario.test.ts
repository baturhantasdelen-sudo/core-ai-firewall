import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  PITCH_USER_INTENT,
  resetPitchScenarioRuntime,
  runPitchScenario,
} from '../lib/engine/demo/pitch-scenario.ts';
import { resetActionFirewallRuntime } from '../lib/engine/action-firewall/index.ts';
import { resetThreatRegistry } from '../lib/engine/immune/index.ts';
import { resetReputationStore } from '../lib/engine/reputation/index.ts';
import { resetEvidenceChainStore } from '../lib/engine/evidence/index.ts';

describe('E2E Pitch Scenario — Investor Demo', () => {
  afterEach(() => {
    resetPitchScenarioRuntime();
    resetActionFirewallRuntime();
    resetThreatRegistry();
    resetReputationStore();
    resetEvidenceChainStore();
  });

  it('runs full invoice → export → external upload mitigation chain', () => {
    const result = runPitchScenario();

    assert.equal(result.userIntent, PITCH_USER_INTENT);
    assert.equal(result.steps.length, 4);
    assert.equal(result.steps[0].tool, 'read_invoice');
    assert.equal(result.steps[0].status, 'OK');
    assert.equal(result.steps[3].tool, 'upload_external_api');
    assert.ok(result.finalDivergenceScore >= 80);
    assert.ok(result.capabilityMode === 'READ_ONLY' || result.capabilitiesRevoked);
    assert.equal(result.evidenceStatus, 'UNVERIFIED_ACTION');
    assert.equal(result.reputationBefore, 92);
    assert.equal(result.reputationAfter, 45);
    assert.ok(result.mitigationSummary.length >= 3);
  });

  it('demotes agent to READ_ONLY instead of full freeze on export step', () => {
    const result = runPitchScenario();
    const exportStep = result.steps.find((step) => step.tool === 'export_customer_database');
    assert.ok(exportStep);
    assert.ok(exportStep!.divergenceScore >= 50);
    assert.notEqual(result.capabilityMode, 'ACTIVE');
  });

  it('blocks external upload after capability revocation', () => {
    const result = runPitchScenario();
    const uploadStep = result.steps.find((step) => step.tool === 'upload_external_api');
    assert.ok(uploadStep);
    assert.equal(uploadStep!.decision, 'BLOCK');
  });
});
