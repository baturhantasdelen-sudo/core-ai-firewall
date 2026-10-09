import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateAssessmentReport } from '@/lib/assessment/generate-report';

describe('Assessment report generator', () => {
  it('returns ESTIMATE label and deterministic output', () => {
    const a = generateAssessmentReport({
      workEmail: 'ciso@example.com',
      companySize: '201-1000',
      agentCount: 12,
      mcpUsage: true,
      financialActions: true,
      erpUsage: true,
      crmUsage: false,
      iamUsage: true,
      cloudActions: false,
    });
    const b = generateAssessmentReport({
      workEmail: 'ciso@example.com',
      companySize: '201-1000',
      agentCount: 12,
      mcpUsage: true,
      financialActions: true,
      erpUsage: true,
      crmUsage: false,
      iamUsage: true,
      cloudActions: false,
    });
    assert.equal(a.label, 'ESTIMATE');
    assert.deepEqual(a, b);
    assert.ok(a.potentialFalseSuccessCases >= 1);
  });
});
