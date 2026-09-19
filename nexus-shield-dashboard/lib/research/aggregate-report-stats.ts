import { createHash } from 'crypto';
import type {
  ResearchScanResultsFile,
  ResearchScanRow,
  ResearchSummaryMetrics,
} from '@/lib/research/types';

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function avgScore(rows: ResearchScanRow[]): number {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((acc, row) => acc + row.securityScore, 0);
  return Math.round((sum / rows.length) * 10) / 10;
}

export function aggregateReportStats(data: ResearchScanResultsFile): ResearchSummaryMetrics {
  const { results } = data;
  const frameworks = results.filter((r) => r.category === 'framework');
  const mcps = results.filter((r) => r.category === 'mcp');

  const lackingValidation = results.filter(
    (r) => r.parameterValidationStatus === 'Missing' || r.parameterValidationStatus === 'Weak',
  ).length;

  const excessiveMcp = mcps.filter((r) =>
    r.privilegeLevel.some((p) => p === 'DB Write' || p === 'Shell Exec' || p === 'Admin File Access'),
  ).length;

  const intentVulnerable = results.filter(
    (r) => r.intentDivergenceRisk === 'High' || r.intentDivergenceRisk === 'Medium',
  ).length;

  const auditAbsent = results.filter((r) => r.auditTrailCapability === 'Absent').length;

  const lackingParameterValidationPct = pct(lackingValidation, results.length);
  const excessiveMcpPermissionsPct = pct(excessiveMcp, mcps.length || 1);
  const intentDivergenceVulnerablePct = pct(intentVulnerable, results.length);
  const auditTrailAbsentPct = pct(auditAbsent, results.length);

  const summary: Omit<ResearchSummaryMetrics, 'verificationHash' | 'keyMetricCards'> = {
    reportId: data.reportId,
    title: data.title,
    generatedAt: data.generatedAt,
    targetCount: data.targetCount,
    frameworksScanned: frameworks.length,
    mcpServersScanned: mcps.length,
    lackingParameterValidationPct,
    excessiveMcpPermissionsPct,
    intentDivergenceVulnerablePct,
    avgSecurityScoreFrameworks: avgScore(frameworks),
    avgSecurityScoreMcp: avgScore(mcps),
    avgSecurityScoreOverall: avgScore(results),
    auditTrailAbsentPct,
  };

  const verificationHash = createHash('sha256').update(JSON.stringify(summary)).digest('hex');

  return {
    ...summary,
    verificationHash,
    keyMetricCards: [
      {
        label: 'Lack Parameter Validation',
        value: `${Math.round(lackingParameterValidationPct)}%`,
        detail: `${lackingValidation} of ${results.length} targets missing or weak schema enforcement`,
      },
      {
        label: 'Excessive MCP Permissions',
        value: `${Math.round(excessiveMcpPermissionsPct)}%`,
        detail: `${excessiveMcp} MCP servers expose write/delete or shell capabilities`,
      },
      {
        label: 'Intent Divergence Risk',
        value: `${Math.round(intentDivergenceVulnerablePct)}%`,
        detail: `${intentVulnerable} setups vulnerable to intent/action mismatch attacks`,
      },
      {
        label: 'Missing Audit Trail',
        value: `${Math.round(auditTrailAbsentPct)}%`,
        detail: `${auditAbsent} targets lack cryptographic evidence chain configuration`,
      },
      {
        label: 'Avg Score — Frameworks',
        value: `${summary.avgSecurityScoreFrameworks}`,
        detail: 'Mean security score across agent frameworks & templates',
      },
      {
        label: 'Avg Score — MCP Servers',
        value: `${summary.avgSecurityScoreMcp}`,
        detail: 'Mean security score across MCP server implementations',
      },
    ],
  };
}
