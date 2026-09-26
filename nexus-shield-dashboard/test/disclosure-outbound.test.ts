import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildOutreachDrafts, buildOutboundBatch } from '../lib/disclosure/outbound-matrix';
import type { DisclosureScanResult } from '../lib/disclosure/types';

function mockResult(org: string, vertical: 'yc-ai-saas' | 'fintech-mcp' | 'enterprise-tr'): DisclosureScanResult {
  return {
    target: {
      id: org.toLowerCase(),
      slug: org.toLowerCase(),
      organizationName: org,
      vertical,
      scanKind: 'github',
      scanSurface: 'https://example.com',
      referenceUrl: 'https://example.com',
    },
    securityScore: 55,
    grade: 'D',
    metrics: {
      parameterHijackingRisk: 'High',
      mcpScopePermissions: ['DB Write'],
      intentDivergenceScore: 85,
      intentDivergenceRisk: 'High',
      parameterValidationStatus: 'Missing',
      evidenceSha256Hash: 'a'.repeat(64),
    },
    vulnerabilities: ['Unvalidated parameter execution'],
    mitigationSteps: ['Deploy Runtime Action Governance'],
    scannedAt: new Date().toISOString(),
    latencyMs: 10,
    fetchStatus: 'ok',
    pdfRelativePath: '/reports/advisories/test-security-advisory-2026.pdf',
    report: {
      score: 55,
      grade: 'D',
      inputType: 'github',
      target: org,
      scannedAt: new Date().toISOString(),
      latencyMs: 10,
      findings: [],
      summary: { critical: 1, high: 0, medium: 0, low: 0 },
      attackSurface: {
        toolsDetected: 0,
        unsignedActions: 1,
        evidenceChainPresent: false,
        intentVerificationPresent: false,
      },
    },
  };
}

describe('disclosure outbound matrix', () => {
  it('builds bilingual outreach drafts with organization name', () => {
    const drafts = buildOutreachDrafts(mockResult('CrewAI', 'yc-ai-saas'));
    assert.match(drafts.emailEn, /CrewAI/);
    assert.match(drafts.emailTr, /CrewAI/);
    assert.match(drafts.linkedinEn, /CrewAI/);
    assert.match(drafts.linkedinTr, /CrewAI/);
  });

  it('aggregates batch with verification hash', () => {
    const batch = buildOutboundBatch([
      mockResult('Logo Yazılım', 'enterprise-tr'),
      mockResult('Stripe MCP', 'fintech-mcp'),
    ]);
    assert.equal(batch.targetCount, 2);
    assert.equal(batch.verticals['enterprise-tr'], 1);
    assert.equal(batch.results[0].pdfPath, '/reports/advisories/test-security-advisory-2026.pdf');
    assert.match(batch.verificationHash, /^[a-f0-9]{64}$/);
  });
});
