import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aggregatePiiStats, buildComplianceReportData, scoreToGrade } from './build-compliance-report.ts';
import type { ScanRecord } from '@/lib/mock-dashboard-data';

describe('compliance report builder', () => {
  it('maps compliance scores to letter grades', () => {
    assert.equal(scoreToGrade(98), 'A+');
    assert.equal(scoreToGrade(91), 'A-');
    assert.equal(scoreToGrade(84), 'B');
    assert.equal(scoreToGrade(55), 'F');
  });

  it('aggregates regional PII statistics', () => {
    const scans: ScanRecord[] = [
      {
        id: '1',
        repoName: 'org/app',
        commitSha: 'abc',
        prNumber: null,
        status: 'blocked',
        createdAt: new Date().toISOString(),
        findings: [
          { type: 'TCKN', filePath: 'a.ts', line: 1, preview: '****' },
          { type: 'TR IBAN', filePath: 'b.ts', line: 2, preview: '****' },
          { type: 'OpenAI API Key', filePath: 'c.ts', line: 3, preview: '****' },
        ],
      },
    ];

    const stats = aggregatePiiStats(scans);
    assert.equal(stats.tckn, 1);
    assert.equal(stats.iban, 1);
    assert.equal(stats.totalMasked, 2);
  });

  it('builds report payload with executive summary', () => {
    const report = buildComplianceReportData({
      organizationName: 'Acme Corp',
      scans: [],
      metrics: {
        totalScans: 10,
        secretsBlocked: 2,
        piiLeaksBlocked: 4,
        complianceScore: 90,
      },
    });

    assert.equal(report.organizationName, 'Acme Corp');
    assert.equal(report.securityGrade, 'A-');
    assert.match(report.executiveSummary, /KVKK Madde 12/);
  });
});
