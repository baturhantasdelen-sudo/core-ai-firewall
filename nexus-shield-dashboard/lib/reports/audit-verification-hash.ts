import { createHash } from 'crypto';
import type { AgentSecurityReport } from '@/lib/scanner';

export function computeAuditVerificationHash(report: AgentSecurityReport): string {
  const payload = JSON.stringify({
    target: report.target,
    inputType: report.inputType,
    score: report.score,
    grade: report.grade,
    scannedAt: report.scannedAt,
    findings: report.findings.map((f) => ({
      id: f.id,
      category: f.category,
      severity: f.severity,
      title: f.title,
    })),
  });

  return createHash('sha256').update(payload).digest('hex');
}
