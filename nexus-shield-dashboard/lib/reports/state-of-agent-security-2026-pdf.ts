import { renderToBuffer } from '@react-pdf/renderer';
import { StateOfAgentSecurity2026Document } from '@/lib/reports/StateOfAgentSecurity2026Document';
import type { ResearchScanResultsFile, ResearchSummaryMetrics } from '@/lib/research/types';

export function stateOfAgentSecurity2026PdfFilename(): string {
  return 'nexus-shield-state-of-agent-security-2026.pdf';
}

export async function generateStateOfAgentSecurity2026PdfBuffer(input: {
  scan: ResearchScanResultsFile;
  summary: ResearchSummaryMetrics;
}): Promise<Buffer> {
  const element = StateOfAgentSecurity2026Document(input);
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
