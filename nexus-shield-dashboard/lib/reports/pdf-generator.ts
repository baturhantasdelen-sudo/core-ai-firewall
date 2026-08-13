import { renderToBuffer } from '@react-pdf/renderer';
import { ComplianceReportDocument } from '@/lib/reports/ComplianceReportDocument';
import type { ComplianceReportData } from '@/lib/reports/types';

export async function generateCompliancePdfBuffer(data: ComplianceReportData): Promise<Buffer> {
  const element = ComplianceReportDocument({ data });
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}

export function compliancePdfFilename(organizationName: string): string {
  const slug = organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const date = new Date().toISOString().slice(0, 10);
  return `nexus-shield-kvkk-compliance-${slug || 'report'}-${date}.pdf`;
}
