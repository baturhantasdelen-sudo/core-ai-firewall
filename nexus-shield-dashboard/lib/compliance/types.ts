/**
 * P3 Sprint 21-22 — Enterprise Compliance & Audit types.
 */

export type ComplianceFramework = 'SOC2_TYPE2' | 'ISO_42001' | 'EU_AI_ACT';

export type AuditControlStatus = 'PASSED' | 'ACTION_REQUIRED';

export interface AuditControl {
  controlId: string;
  title: string;
  framework: ComplianceFramework;
  status: AuditControlStatus;
  evidence: string;
  score: number;
}

export interface ComplianceMetricsSnapshot {
  evidenceVerificationRate: number;
  redTeamResilienceScore: number;
  jitRevocationCount: number;
  avgReputationScore: number;
  threatIntelIocCount: number;
  memoryPoisonIncidents: number;
  blockedActionRate: number;
}

export interface ComplianceEvaluation {
  framework: ComplianceFramework;
  complianceScore: number;
  controls: AuditControl[];
  metrics: ComplianceMetricsSnapshot;
  passedCount: number;
  actionRequiredCount: number;
  evaluatedAt: string;
}

export interface ComplianceReport {
  reportId: string;
  framework: ComplianceFramework;
  complianceScore: number;
  controls: AuditControl[];
  metrics: ComplianceMetricsSnapshot;
  reportHash: string;
  cryptographicSignature: string;
  generatedAt: string;
  auditorSummary: string;
}

export interface ExportAuditBundle {
  format: 'JSON' | 'PDF';
  report: ComplianceReport;
  bundleHash: string;
  exportedAt: string;
}

export function isPassedControl(control: AuditControl): boolean {
  return control.status === 'PASSED';
}
