import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { AgentSecurityReport } from '@/lib/scanner';
import {
  agentSecurityPdfFilename,
  generateAgentSecurityPdfBuffer,
} from '@/lib/pdf-report-generator';

export const runtime = 'nodejs';

const findingSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.enum([
    'excessive_authority',
    'unsigned_actions',
    'intent_verification',
    'tool_misuse',
    'parameter_hijack',
    'evidence_chain',
  ]),
  description: z.string(),
  recommendation: z.string(),
  sdkFix: z.string().optional(),
});

const reportSchema = z.object({
  score: z.number().min(0).max(100),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  inputType: z.enum(['endpoint', 'mcp', 'github']),
  target: z.string(),
  scannedAt: z.string(),
  latencyMs: z.number(),
  findings: z.array(findingSchema),
  summary: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
  }),
  attackSurface: z.object({
    toolsDetected: z.number(),
    unsignedActions: z.number(),
    evidenceChainPresent: z.boolean(),
    intentVerificationPresent: z.boolean(),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = reportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid report payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const report = parsed.data as AgentSecurityReport;
    const pdfBuffer = await generateAgentSecurityPdfBuffer(report);
    const filename = agentSecurityPdfFilename(report);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
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
