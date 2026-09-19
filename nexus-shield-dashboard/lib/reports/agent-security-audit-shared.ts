import type { AgentSecurityReport, FindingCategory } from '@/lib/scanner';

export const CATEGORY_LABELS: Record<FindingCategory, string> = {
  excessive_authority: 'Excessive Authority',
  unsigned_actions: 'Unsigned Tool Calls',
  intent_verification: 'Intent Divergence',
  tool_misuse: 'Tool Misuse',
  parameter_hijack: 'Parameter Hijack',
  evidence_chain: 'Evidence Chain Gaps',
};

export function inputTypeLabel(inputType: AgentSecurityReport['inputType']): string {
  switch (inputType) {
    case 'endpoint':
      return 'Agent API Endpoint';
    case 'mcp':
      return 'MCP Config JSON';
    case 'github':
      return 'GitHub Repository';
  }
}

export function overallSeverityLabel(report: AgentSecurityReport): string {
  if (report.summary.critical > 0) return 'Critical';
  if (report.summary.high > 0) return 'High';
  if (report.summary.medium > 0) return 'Medium';
  if (report.summary.low > 0) return 'Low';
  return 'Informational';
}

export function agentSecurityPdfFilename(report?: AgentSecurityReport): string {
  const ts = report?.scannedAt
    ? report.scannedAt.replace(/[:.]/g, '-').slice(0, 19)
    : new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `nexus-shield-security-report-${ts}.pdf`;
}
