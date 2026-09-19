import type { AgentSecurityReport } from '@/lib/scanner';

export type ResearchCategory = 'framework' | 'mcp';

export type ParameterValidationStatus = 'Missing' | 'Weak' | 'Enforced';
export type IntentDivergenceRisk = 'High' | 'Medium' | 'Low';
export type AuditTrailCapability = 'Present' | 'Absent';

export interface ResearchTarget {
  id: string;
  slug: string;
  name: string;
  category: ResearchCategory;
  github: string;
  githubUrl: string;
  /** Optional sub-path inside monorepo (e.g. MCP server package) */
  contentPath?: string;
}

export interface ResearchScanRow {
  id: string;
  slug: string;
  name: string;
  category: ResearchCategory;
  github: string;
  githubUrl: string;
  securityScore: number;
  grade: AgentSecurityReport['grade'];
  parameterValidationStatus: ParameterValidationStatus;
  privilegeLevel: string[];
  intentDivergenceRisk: IntentDivergenceRisk;
  auditTrailCapability: AuditTrailCapability;
  auditHash: string;
  scannedAt: string;
  latencyMs: number;
  fetchStatus: 'ok' | 'partial' | 'error';
  fetchError?: string;
  findingsCount: number;
  report: AgentSecurityReport;
}

export interface ResearchScanResultsFile {
  reportId: string;
  title: string;
  generatedAt: string;
  targetCount: number;
  results: ResearchScanRow[];
}

export interface ResearchSummaryMetrics {
  reportId: string;
  title: string;
  generatedAt: string;
  targetCount: number;
  frameworksScanned: number;
  mcpServersScanned: number;
  lackingParameterValidationPct: number;
  excessiveMcpPermissionsPct: number;
  intentDivergenceVulnerablePct: number;
  avgSecurityScoreFrameworks: number;
  avgSecurityScoreMcp: number;
  avgSecurityScoreOverall: number;
  auditTrailAbsentPct: number;
  keyMetricCards: Array<{ label: string; value: string; detail: string }>;
  verificationHash: string;
}
