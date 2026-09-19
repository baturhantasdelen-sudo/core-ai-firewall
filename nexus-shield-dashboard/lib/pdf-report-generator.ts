import { renderToBuffer } from '@react-pdf/renderer';
import { AgentSecurityAuditDocument } from '@/lib/reports/AgentSecurityAuditDocument';
import { computeAuditVerificationHash } from '@/lib/reports/audit-verification-hash';
import type { AgentSecurityReport } from '@/lib/scanner';

export { computeAuditVerificationHash } from '@/lib/reports/audit-verification-hash';

export {
  CATEGORY_LABELS,
  agentSecurityPdfFilename,
  inputTypeLabel,
  overallSeverityLabel,
} from '@/lib/reports/agent-security-audit-shared';

export async function generateAgentSecurityPdfBuffer(
  report: AgentSecurityReport,
): Promise<Buffer> {
  const auditHash = computeAuditVerificationHash(report);
  const element = AgentSecurityAuditDocument({ report, auditHash });
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
