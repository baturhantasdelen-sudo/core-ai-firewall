import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  buildComplianceEvidenceBundle,
  complianceBundleToCsvControls,
} from '@/lib/compliance/build-evidence-bundle';
import { authorizeComplianceMonitor } from '@/lib/compliance/authorize-monitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/compliance/evidence — GRC polling endpoint (Vanta / Drata / Secureframe). */
export async function GET(req: NextRequest) {
  const auth = await authorizeComplianceMonitor(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const bundle = buildComplianceEvidenceBundle();
    const format = req.nextUrl.searchParams.get('format')?.toLowerCase();

    if (format === 'csv') {
      const csv = complianceBundleToCsvControls(bundle);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="nexusshield-compliance-controls.csv"',
          'Cache-Control': 'no-store',
          'X-Evidence-SHA256': bundle.integrity.sha256,
        },
      });
    }

    return NextResponse.json(bundle, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Evidence-SHA256': bundle.integrity.sha256,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build compliance evidence';
    console.error('[compliance/evidence] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {
      endpoint: '/api/v1/compliance/evidence',
      methods: ['GET'],
      auth: ['x-compliance-monitor-token', 'x-api-key', 'x-nexus-api-key'],
      query: { format: 'json | csv' },
    },
    { status: 200 },
  );
}
