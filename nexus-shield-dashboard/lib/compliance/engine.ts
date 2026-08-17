import { createHash, createHmac } from 'node:crypto';
import type {
  AuditControl,
  AuditControlStatus,
  ComplianceEvaluation,
  ComplianceFramework,
  ComplianceMetricsSnapshot,
  ComplianceReport,
  ExportAuditBundle,
} from '@/lib/compliance/types';

const SIGNING_SECRET = process.env.NEXUS_COMPLIANCE_SIGNING_SECRET ?? 'nexus-shield-compliance-p3-dev-key';

const reportStore = new Map<string, ComplianceReport>();

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function signPayload(payload: string): string {
  return createHmac('sha256', SIGNING_SECRET).update(payload, 'utf8').digest('hex');
}

function controlStatus(score: number, threshold: number): AuditControlStatus {
  return score >= threshold ? 'PASSED' : 'ACTION_REQUIRED';
}

function buildControls(
  framework: ComplianceFramework,
  metrics: ComplianceMetricsSnapshot,
): AuditControl[] {
  const evidenceScore = metrics.evidenceVerificationRate;
  const resilienceScore = metrics.redTeamResilienceScore;
  const reputationScore = metrics.avgReputationScore;
  const jitScore = Math.max(0, 100 - metrics.jitRevocationCount * 8);
  const threatScore = Math.min(100, metrics.threatIntelIocCount * 12);
  const memoryScore = Math.max(0, 100 - metrics.memoryPoisonIncidents * 15);
  const firewallScore = Math.max(0, 100 - Math.round(metrics.blockedActionRate * 100 * 0.5));

  const baseControls: Array<Omit<AuditControl, 'framework'>> = [
    {
      controlId: 'CC-EVIDENCE-01',
      title: 'Cryptographic evidence verification coverage',
      status: controlStatus(evidenceScore, 80),
      evidence: `${metrics.evidenceVerificationRate}% bundles verified with Merkle proofs`,
      score: evidenceScore,
    },
    {
      controlId: 'CC-REDTEAM-02',
      title: 'Continuous red team resilience threshold',
      status: controlStatus(resilienceScore, 75),
      evidence: `Red team resilience score ${metrics.redTeamResilienceScore}/100`,
      score: resilienceScore,
    },
    {
      controlId: 'CC-JIT-03',
      title: 'Ephemeral credential revocation discipline',
      status: controlStatus(jitScore, 70),
      evidence: `${metrics.jitRevocationCount} JIT revocations in audit window`,
      score: jitScore,
    },
    {
      controlId: 'CC-REPUTATION-04',
      title: 'Agent reputation & dynamic trust enforcement',
      status: controlStatus(reputationScore, 65),
      evidence: `Fleet average reputation ${metrics.avgReputationScore}/100`,
      score: reputationScore,
    },
    {
      controlId: 'CC-THREAT-05',
      title: 'Collective threat intelligence IOC ingestion',
      status: controlStatus(threatScore, 60),
      evidence: `${metrics.threatIntelIocCount} anonymized IOCs synced`,
      score: threatScore,
    },
    {
      controlId: 'CC-MEMORY-06',
      title: 'Vector memory poisoning detection & quarantine',
      status: controlStatus(memoryScore, 75),
      evidence: `${metrics.memoryPoisonIncidents} poison incidents detected`,
      score: memoryScore,
    },
    {
      controlId: 'CC-FIREWALL-07',
      title: 'Adaptive action firewall block efficacy',
      status: controlStatus(firewallScore, 70),
      evidence: `${Math.round(metrics.blockedActionRate * 100)}% blocked action rate`,
      score: firewallScore,
    },
  ];

  const frameworkLabels: Record<ComplianceFramework, Record<string, string>> = {
    SOC2_TYPE2: {
      'CC-EVIDENCE-01': 'SOC2 CC7.2 — Security event monitoring via evidence chain',
      'CC-REDTEAM-02': 'SOC2 CC4.1 — Ongoing risk assessment via red teaming',
      'CC-JIT-03': 'SOC2 CC6.1 — Logical access via JIT credentials',
    },
    ISO_42001: {
      'CC-EVIDENCE-01': 'ISO 42001 A.8 — AI system monitoring records',
      'CC-REDTEAM-02': 'ISO 42001 A.6 — AI risk treatment verification',
      'CC-MEMORY-06': 'ISO 42001 A.7 — Data governance for agent memory',
    },
    EU_AI_ACT: {
      'CC-EVIDENCE-01': 'EU AI Act Art. 12 — Record-keeping & traceability',
      'CC-REPUTATION-04': 'EU AI Act Art. 14 — Human oversight via trust tiers',
      'CC-THREAT-05': 'EU AI Act Art. 15 — Accuracy & robustness — threat intel',
    },
  };

  return baseControls.map((control) => ({
    ...control,
    framework,
    title: frameworkLabels[framework][control.controlId] ?? control.title,
  }));
}

function computeComplianceScore(controls: AuditControl[]): number {
  if (controls.length === 0) return 0;
  const total = controls.reduce((sum, control) => sum + control.score, 0);
  return Math.round(total / controls.length);
}

function buildAuditorSummary(framework: ComplianceFramework, score: number, passed: number, total: number): string {
  const frameworkName =
    framework === 'SOC2_TYPE2'
      ? 'SOC 2 Type II'
      : framework === 'ISO_42001'
        ? 'ISO/IEC 42001'
        : 'EU AI Act';

  if (score >= 85) {
    return `${frameworkName} audit: ${passed}/${total} controls passed. Fleet demonstrates strong P0–P3 control coverage with verified evidence, resilient red team posture, and active threat intelligence sharing.`;
  }
  if (score >= 70) {
    return `${frameworkName} audit: ${passed}/${total} controls passed. Material compliance achieved; targeted remediation recommended for ACTION_REQUIRED controls before external auditor sign-off.`;
  }
  return `${frameworkName} audit: ${passed}/${total} controls passed. Significant gaps detected across agent trust layers — immediate remediation plan required.`;
}

/** Default P0–P3 fleet metrics for compliance evaluation. */
export function buildDefaultComplianceMetrics(): ComplianceMetricsSnapshot {
  return {
    evidenceVerificationRate: 88,
    redTeamResilienceScore: 92,
    jitRevocationCount: 4,
    avgReputationScore: 78,
    threatIntelIocCount: 6,
    memoryPoisonIncidents: 1,
    blockedActionRate: 0.12,
  };
}

/**
 * Evaluates compliance score against selected framework using P0–P3 system metrics.
 */
export function evaluateComplianceScore(
  framework: ComplianceFramework,
  metrics: ComplianceMetricsSnapshot = buildDefaultComplianceMetrics(),
): ComplianceEvaluation {
  const controls = buildControls(framework, metrics);
  const complianceScore = computeComplianceScore(controls);
  const passedCount = controls.filter((control) => control.status === 'PASSED').length;
  const actionRequiredCount = controls.length - passedCount;

  return {
    framework,
    complianceScore,
    controls,
    metrics,
    passedCount,
    actionRequiredCount,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Generates a cryptographically signed audit report for the selected framework.
 */
export function generateAuditReport(
  framework: ComplianceFramework,
  metrics?: ComplianceMetricsSnapshot,
): ComplianceReport {
  const evaluation = evaluateComplianceScore(framework, metrics);
  const generatedAt = new Date().toISOString();
  const reportId = `aud_${sha256(`${framework}:${generatedAt}`).slice(0, 14)}`;

  const reportBody = {
    reportId,
    framework,
    complianceScore: evaluation.complianceScore,
    controls: evaluation.controls,
    metrics: evaluation.metrics,
    generatedAt,
  };

  const reportHash = sha256(JSON.stringify(reportBody));
  const signingPayload = [reportId, framework, String(evaluation.complianceScore), reportHash, generatedAt].join('|');
  const cryptographicSignature = signPayload(signingPayload);

  const report: ComplianceReport = {
    ...reportBody,
    reportHash,
    cryptographicSignature,
    auditorSummary: buildAuditorSummary(
      framework,
      evaluation.complianceScore,
      evaluation.passedCount,
      evaluation.controls.length,
    ),
  };

  reportStore.set(reportId, report);
  return report;
}

export function verifyAuditReportSignature(report: ComplianceReport): boolean {
  const signingPayload = [
    report.reportId,
    report.framework,
    String(report.complianceScore),
    report.reportHash,
    report.generatedAt,
  ].join('|');

  return signPayload(signingPayload) === report.cryptographicSignature;
}

export function exportSignedAuditBundle(
  report: ComplianceReport,
  format: ExportAuditBundle['format'],
): ExportAuditBundle {
  const bundlePayload = {
    format,
    report,
    exportedAt: new Date().toISOString(),
  };

  return {
    format,
    report,
    bundleHash: sha256(JSON.stringify(bundlePayload)),
    exportedAt: bundlePayload.exportedAt,
  };
}

export function getAuditReport(reportId: string): ComplianceReport | undefined {
  return reportStore.get(reportId);
}

export function listAuditReports(): ComplianceReport[] {
  return [...reportStore.values()].sort(
    (a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt),
  );
}

export function resetComplianceEngineStore(): void {
  reportStore.clear();
}

export function evaluateAllFrameworks(
  metrics?: ComplianceMetricsSnapshot,
): ComplianceEvaluation[] {
  const frameworks: ComplianceFramework[] = ['SOC2_TYPE2', 'ISO_42001', 'EU_AI_ACT'];
  return frameworks.map((framework) => evaluateComplianceScore(framework, metrics));
}
