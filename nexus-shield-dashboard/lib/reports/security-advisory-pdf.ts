import { renderToBuffer } from '@react-pdf/renderer';
import { SecurityAdvisoryDocument } from '@/lib/reports/SecurityAdvisoryDocument';
import type { DisclosureScanResult } from '@/lib/disclosure/types';

export async function generateSecurityAdvisoryPdfBuffer(
  result: DisclosureScanResult,
): Promise<Buffer> {
  const element = SecurityAdvisoryDocument({ result });
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
