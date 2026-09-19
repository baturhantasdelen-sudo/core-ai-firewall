import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeAuditVerificationHash } from '../lib/reports/audit-verification-hash.ts';
import { agentSecurityPdfFilename } from '../lib/reports/agent-security-audit-shared.ts';
import type { AgentSecurityReport } from '../lib/scanner.ts';

const SAMPLE_REPORT: AgentSecurityReport = {
  score: 42,
  grade: 'D',
  inputType: 'mcp',
  target: 'mcp-config',
  scannedAt: '2026-09-18T12:00:00.000Z',
  latencyMs: 12,
  findings: [
    {
      id: 'NS-F001',
      title: 'Missing Intent-Action Verification',
      severity: 'critical',
      category: 'intent_verification',
      description: 'No intent layer detected.',
      recommendation: 'Enable Action Firewall.',
      sdkFix: 'NexusShield.evaluateAction({ userIntent, toolCall })',
    },
  ],
  summary: { critical: 1, high: 0, medium: 0, low: 0 },
  attackSurface: {
    toolsDetected: 2,
    unsignedActions: 1,
    evidenceChainPresent: false,
    intentVerificationPresent: false,
  },
};

describe('pdf-report-generator', () => {
  it('produces stable SHA-256 audit verification hash', () => {
    const hashA = computeAuditVerificationHash(SAMPLE_REPORT);
    const hashB = computeAuditVerificationHash(SAMPLE_REPORT);
    assert.match(hashA, /^[a-f0-9]{64}$/);
    assert.equal(hashA, hashB);
  });

  it('names PDF files with nexus-shield-security-report prefix and timestamp', () => {
    const name = agentSecurityPdfFilename(SAMPLE_REPORT);
    assert.match(name, /^nexus-shield-security-report-2026-09-18T12-00-00\.pdf$/);
  });
});
