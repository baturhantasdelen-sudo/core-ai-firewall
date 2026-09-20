import type { AgentSecurityReport } from '@/lib/scanner';
import type { IntentDivergenceRisk, ParameterValidationStatus } from '@/lib/research/types';

export type DisclosureVertical = 'yc-ai-saas' | 'fintech-mcp' | 'enterprise-tr';

export type ScanInputKind = 'github' | 'endpoint' | 'mcp';

export interface DisclosureTarget {
  id: string;
  slug: string;
  organizationName: string;
  vertical: DisclosureVertical;
  scanKind: ScanInputKind;
  /** GitHub repo (owner/repo), URL, or MCP JSON surface descriptor */
  scanSurface: string;
  referenceUrl: string;
  github?: string;
  contentPath?: string;
  /** Generic security inbox for responsible disclosure outreach */
  outreachEmail?: string;
  /** Named CISO / security lead when a direct contact is known */
  cisoEmail?: string;
}

export interface DisclosureVulnerabilityMetrics {
  parameterHijackingRisk: 'High' | 'Medium' | 'Low';
  mcpScopePermissions: string[];
  intentDivergenceScore: number;
  intentDivergenceRisk: IntentDivergenceRisk;
  parameterValidationStatus: ParameterValidationStatus;
  evidenceSha256Hash: string;
}

export interface DisclosureScanResult {
  target: DisclosureTarget;
  securityScore: number;
  grade: AgentSecurityReport['grade'];
  metrics: DisclosureVulnerabilityMetrics;
  vulnerabilities: string[];
  mitigationSteps: string[];
  scannedAt: string;
  latencyMs: number;
  fetchStatus: 'ok' | 'partial' | 'error';
  fetchError?: string;
  pdfRelativePath: string;
  report: AgentSecurityReport;
}

export interface OutreachDrafts {
  emailEn: string;
  emailTr: string;
  linkedinEn: string;
  linkedinTr: string;
}

export interface OutboundDisclosureRow {
  organizationName: string;
  vertical: DisclosureVertical;
  verticalLabel: string;
  securityScore: number;
  grade: AgentSecurityReport['grade'];
  pdfPath: string;
  evidenceHash: string;
  parameterHijackingRisk: string;
  intentDivergenceScore: number;
  outreachEmail?: string;
  cisoEmail?: string;
  outreach: OutreachDrafts;
}

export interface OutboundDisclosureBatch {
  batchId: string;
  generatedAt: string;
  targetCount: number;
  verticals: Record<DisclosureVertical, number>;
  results: OutboundDisclosureRow[];
  verificationHash: string;
}
