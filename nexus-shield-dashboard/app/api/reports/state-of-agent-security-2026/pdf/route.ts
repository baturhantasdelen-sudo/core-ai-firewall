import { NextResponse } from 'next/server';
import { loadReportBundle2026 } from '@/lib/research/load-report-data';
import {
  generateStateOfAgentSecurity2026PdfBuffer,
  stateOfAgentSecurity2026PdfFilename,
} from '@/lib/reports/state-of-agent-security-2026-pdf';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const bundle = await loadReportBundle2026();
    const pdf = await generateStateOfAgentSecurity2026PdfBuffer({
      scan: bundle.scan,
      summary: bundle.summary,
    });
    const filename = stateOfAgentSecurity2026PdfFilename();

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600',
        'X-Audit-Hash': bundle.summary.verificationHash,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'PDF generation failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
