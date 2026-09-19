import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aggregateReportStats } from '../lib/research/aggregate-report-stats';
import type { ResearchScanResultsFile } from '../lib/research/types';

function mockRow(overrides: Partial<ResearchScanResultsFile['results'][0]>) {
  return {
    id: 'test',
    slug: 'test/repo',
    name: 'test/repo',
    category: 'framework' as const,
    github: 'test/repo',
    githubUrl: 'https://github.com/test/repo',
    securityScore: 50,
    grade: 'D' as const,
    parameterValidationStatus: 'Missing' as const,
    privilegeLevel: ['DB Write'],
    intentDivergenceRisk: 'High' as const,
    auditTrailCapability: 'Absent' as const,
    auditHash: 'abc',
    scannedAt: new Date().toISOString(),
    latencyMs: 10,
    fetchStatus: 'ok' as const,
    findingsCount: 3,
    report: {
      score: 50,
      grade: 'D',
      inputType: 'github',
      target: 'test/repo',
      scannedAt: new Date().toISOString(),
      latencyMs: 10,
      findings: [],
      summary: { critical: 1, high: 1, medium: 1, low: 0 },
      attackSurface: {
        toolsDetected: 0,
        unsignedActions: 2,
        evidenceChainPresent: false,
        intentVerificationPresent: false,
      },
    },
    ...overrides,
  };
}

describe('aggregateReportStats', () => {
  it('computes summary percentages for mixed framework and MCP rows', () => {
    const data: ResearchScanResultsFile = {
      reportId: 'state-of-agent-security-2026',
      title: 'State of AI Agent Security 2026',
      generatedAt: new Date().toISOString(),
      targetCount: 4,
      results: [
        mockRow({ id: '1', category: 'framework', parameterValidationStatus: 'Missing' }),
        mockRow({ id: '2', category: 'framework', parameterValidationStatus: 'Enforced', securityScore: 80 }),
        mockRow({ id: '3', category: 'mcp', privilegeLevel: ['Shell Exec'] }),
        mockRow({
          id: '4',
          category: 'mcp',
          parameterValidationStatus: 'Weak',
          intentDivergenceRisk: 'Low',
          auditTrailCapability: 'Present',
        }),
      ],
    };

    const summary = aggregateReportStats(data);
    assert.equal(summary.targetCount, 4);
    assert.equal(summary.frameworksScanned, 2);
    assert.equal(summary.mcpServersScanned, 2);
    assert.equal(summary.lackingParameterValidationPct, 75);
    assert.equal(summary.excessiveMcpPermissionsPct, 100);
    assert.equal(summary.intentDivergenceVulnerablePct, 75);
    assert.ok(summary.verificationHash.length === 64);
    assert.equal(summary.keyMetricCards.length, 6);
  });
});
