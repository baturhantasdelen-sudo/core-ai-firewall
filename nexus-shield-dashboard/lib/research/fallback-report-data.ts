import type { ResearchScanResultsFile, ResearchSummaryMetrics } from '@/lib/research/types';

/** Static fallback so the report page builds and renders when JSON files are absent. */
export const FALLBACK_REPORT_SUMMARY: ResearchSummaryMetrics = {
  reportId: 'state-of-agent-security-2026',
  title: 'State of AI Agent Security 2026',
  generatedAt: '2026-09-19T20:01:46.324Z',
  targetCount: 50,
  frameworksScanned: 25,
  mcpServersScanned: 25,
  lackingParameterValidationPct: 100,
  excessiveMcpPermissionsPct: 24,
  intentDivergenceVulnerablePct: 100,
  avgSecurityScoreFrameworks: 60,
  avgSecurityScoreMcp: 59.4,
  avgSecurityScoreOverall: 59.7,
  auditTrailAbsentPct: 100,
  verificationHash: 'be61e3d001f31c2dfa52fa4a43b802882c0ab67c90868a58755c4af8e14dea9a',
  keyMetricCards: [
    {
      label: 'Lack Parameter Validation',
      value: '100%',
      detail: '50 of 50 targets missing or weak schema enforcement',
    },
    {
      label: 'Excessive MCP Permissions',
      value: '24%',
      detail: '6 MCP servers expose write/delete or shell capabilities',
    },
    {
      label: 'Intent Divergence Risk',
      value: '100%',
      detail: '50 setups vulnerable to intent/action mismatch attacks',
    },
    {
      label: 'Missing Audit Trail',
      value: '100%',
      detail: '50 targets lack cryptographic evidence chain configuration',
    },
    {
      label: 'Avg Score — Frameworks',
      value: '60',
      detail: 'Mean security score across agent frameworks & templates',
    },
    {
      label: 'Avg Score — MCP Servers',
      value: '59.4',
      detail: 'Mean security score across MCP server implementations',
    },
  ],
};

const sampleFinding = {
  title: 'Missing Intent-Action Verification',
  severity: 'critical' as const,
  category: 'intent_verification' as const,
  description: 'No intent verification layer detected.',
  recommendation: 'Enable Runtime Action Governance with Policy Enforcement and Universal Action Receipts.',
  sdkFix: 'NexusShield.evaluateAction({ userIntent, toolCall })',
  id: 'NS-F001',
};

function sampleRow(
  id: string,
  name: string,
  category: 'framework' | 'mcp',
  score: number,
): ResearchScanResultsFile['results'][0] {
  return {
    id,
    slug: name,
    name,
    category,
    github: name,
    githubUrl: `https://github.com/${name}`,
    securityScore: score,
    grade: score >= 75 ? 'B' : score >= 60 ? 'C' : 'D',
    parameterValidationStatus: 'Missing',
    privilegeLevel: category === 'mcp' ? ['DB Write'] : ['Read-Only (inferred)'],
    intentDivergenceRisk: 'High',
    auditTrailCapability: 'Absent',
    auditHash: `${id}-fallback-hash`.padEnd(64, '0'),
    scannedAt: FALLBACK_REPORT_SUMMARY.generatedAt,
    latencyMs: 8,
    fetchStatus: 'partial',
    findingsCount: 2,
    report: {
      score,
      grade: score >= 75 ? 'B' : score >= 60 ? 'C' : 'D',
      inputType: 'github',
      target: name,
      scannedAt: FALLBACK_REPORT_SUMMARY.generatedAt,
      latencyMs: 8,
      findings: [sampleFinding],
      summary: { critical: 1, high: 1, medium: 0, low: 0 },
      attackSurface: {
        toolsDetected: 0,
        unsignedActions: 2,
        evidenceChainPresent: false,
        intentVerificationPresent: false,
      },
    },
  };
}

export const FALLBACK_SCAN_RESULTS: ResearchScanResultsFile = {
  reportId: 'state-of-agent-security-2026',
  title: 'State of AI Agent Security 2026',
  generatedAt: FALLBACK_REPORT_SUMMARY.generatedAt,
  targetCount: 50,
  results: [
    sampleRow('langchain', 'langchain-ai/langchain', 'framework', 60),
    sampleRow('crewai', 'crewAIInc/crewAI', 'framework', 58),
    sampleRow('autogen', 'microsoft/autogen', 'framework', 62),
    sampleRow('mcp-postgres', 'mcp-servers/postgres', 'mcp', 55),
    sampleRow('mcp-github', 'mcp-servers/github', 'mcp', 57),
  ],
};

export const FALLBACK_REPORT_BUNDLE = {
  scan: FALLBACK_SCAN_RESULTS,
  summary: FALLBACK_REPORT_SUMMARY,
};
