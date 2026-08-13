import { NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/session';
import { buildComplianceReportData } from '@/lib/reports/build-compliance-report';
import { compliancePdfFilename, generateCompliancePdfBuffer } from '@/lib/reports/pdf-generator';
import { getRecentScans, getScanMetrics } from '@/lib/scans';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const auth = await requireAuthContext();
    const [scans, metrics] = await Promise.all([
      getRecentScans(auth.org.id, 50),
      getScanMetrics(auth.org.id),
    ]);

    const reportData = buildComplianceReportData({
      organizationName: auth.org.name,
      scans,
      metrics,
    });

    const pdfBuffer = await generateCompliancePdfBuffer(reportData);
    const filename = compliancePdfFilename(auth.org.name);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate compliance report';
    const status = message === 'Unauthorized' ? 401 : 500;
    console.error('[reports/compliance] error:', message);
    return NextResponse.json({ error: message }, { status });
  }
}
