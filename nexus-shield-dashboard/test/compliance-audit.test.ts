import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  buildDefaultComplianceMetrics,
  evaluateAllFrameworks,
  evaluateComplianceScore,
  exportSignedAuditBundle,
  generateAuditReport,
  resetComplianceEngineStore,
  verifyAuditReportSignature,
} from '../lib/compliance/index.ts';

describe('P3 Enterprise Compliance Engine', () => {
  afterEach(() => {
    resetComplianceEngineStore();
  });

  it('evaluateComplianceScore returns controls and compliance score', () => {
    const evaluation = evaluateComplianceScore('SOC2_TYPE2');

    assert.equal(evaluation.framework, 'SOC2_TYPE2');
    assert.ok(evaluation.complianceScore >= 0 && evaluation.complianceScore <= 100);
    assert.ok(evaluation.controls.length >= 7);
    assert.equal(evaluation.passedCount + evaluation.actionRequiredCount, evaluation.controls.length);
  });

  it('generateAuditReport produces signed report with hash', () => {
    const report = generateAuditReport('ISO_42001');

    assert.ok(report.reportId.startsWith('aud_'));
    assert.ok(report.reportHash.length >= 64);
    assert.ok(report.cryptographicSignature.length >= 64);
    assert.ok(report.auditorSummary.length > 0);
    assert.equal(verifyAuditReportSignature(report), true);
  });

  it('exportSignedAuditBundle includes bundle hash', () => {
    const report = generateAuditReport('EU_AI_ACT');
    const bundle = exportSignedAuditBundle(report, 'JSON');

    assert.equal(bundle.format, 'JSON');
    assert.equal(bundle.report.reportId, report.reportId);
    assert.ok(bundle.bundleHash.length >= 64);
  });

  it('evaluateAllFrameworks covers SOC2, ISO 42001, and EU AI Act', () => {
    const evaluations = evaluateAllFrameworks();
    assert.equal(evaluations.length, 3);

    const frameworks = evaluations.map((evaluation) => evaluation.framework);
    assert.ok(frameworks.includes('SOC2_TYPE2'));
    assert.ok(frameworks.includes('ISO_42001'));
    assert.ok(frameworks.includes('EU_AI_ACT'));
  });

  it('low metrics produce ACTION_REQUIRED controls', () => {
    const evaluation = evaluateComplianceScore('SOC2_TYPE2', {
      evidenceVerificationRate: 40,
      redTeamResilienceScore: 30,
      jitRevocationCount: 20,
      avgReputationScore: 35,
      threatIntelIocCount: 0,
      memoryPoisonIncidents: 8,
      blockedActionRate: 0.45,
    });

    assert.ok(evaluation.complianceScore < 70);
    assert.ok(evaluation.actionRequiredCount > 0);
    assert.ok(evaluation.controls.some((control) => control.status === 'ACTION_REQUIRED'));
  });

  it('strong metrics produce high compliance score', () => {
    const evaluation = evaluateComplianceScore('EU_AI_ACT', {
      ...buildDefaultComplianceMetrics(),
      evidenceVerificationRate: 98,
      redTeamResilienceScore: 96,
      jitRevocationCount: 1,
      avgReputationScore: 92,
      threatIntelIocCount: 8,
      memoryPoisonIncidents: 0,
      blockedActionRate: 0.05,
    });

    assert.ok(evaluation.complianceScore >= 85);
    assert.ok(evaluation.passedCount >= 5);
  });
});
