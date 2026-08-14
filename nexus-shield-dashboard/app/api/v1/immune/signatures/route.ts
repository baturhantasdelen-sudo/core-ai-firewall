import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiKey, extractApiKey } from '@/lib/auth/api-key';
import {
  getImmuneNetworkStats,
  listThreatSignatures,
  registerThreatSignature,
  type BehavioralThreatSignature,
} from '@/lib/engine/immune';

export const runtime = 'nodejs';

const signatureSchema = z.object({
  id: z.string().min(1),
  signatureHash: z.string().min(8),
  category: z.enum(['GOAL_HIJACK', 'PRIVILEGE_ESCALATION', 'TOOL_MISUSE', 'DATA_EXFILTRATION']),
  pattern: z.array(z.string()).min(1),
  severity: z.enum(['HIGH', 'CRITICAL']),
  createdAt: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing x-api-key or x-nexus-api-key header' },
        { status: 401 },
      );
    }

    const org = await authenticateApiKey(apiKey);
    if (!org) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
    }

    const signatures = listThreatSignatures();
    const stats = getImmuneNetworkStats();

    return NextResponse.json({
      success: true,
      immune_network_status: stats.status,
      total_signatures: stats.totalSignatures,
      critical_signatures: stats.criticalSignatures,
      categories: stats.categories,
      signatures,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = extractApiKey(req);
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing x-api-key or x-nexus-api-key header' },
        { status: 401 },
      );
    }

    const org = await authenticateApiKey(apiKey);
    if (!org) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = signatureSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const signature: BehavioralThreatSignature = {
      ...parsed.data,
      createdAt: parsed.data.createdAt ?? new Date().toISOString(),
    };

    registerThreatSignature(signature);

    return NextResponse.json(
      {
        success: true,
        signature,
        immune_network_status: getImmuneNetworkStats().status,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
