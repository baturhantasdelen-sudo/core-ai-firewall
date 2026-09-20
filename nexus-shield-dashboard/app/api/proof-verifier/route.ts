import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  recordOutcomeVerification,
  verifyActionOutcome,
  type ProofComponent,
} from '@/lib/engine/evidence/evidential-verifier';
import { applyEdgeMicroCache, applyNoStore } from '@/lib/http/cache-headers';

export const runtime = 'nodejs';

const PROOF_COMPONENTS: ProofComponent[] = [
  'TRANSACTION_ID',
  'BANK_API_RESPONSE',
  'DATABASE_RECORD_HASH',
  'EXECUTION_LOG',
  'AUTHORIZED_AGENT_SIGNATURE',
];

const ACTION_CATEGORIES = ['FINANCIAL', 'PAYMENT', 'EXPORT', 'DB_WRITE', 'EXECUTE', 'GENERAL'] as const;

const verifySchema = z.object({
  toolName: z.string().min(1).max(256),
  actionType: z.string().max(64).optional(),
  agentId: z.string().max(128).optional(),
  args: z.record(z.string(), z.unknown()).optional(),
  evidence: z
    .object({
      transactionId: z.string().optional(),
      bankApiResponse: z.string().optional(),
      databaseRecordHash: z.string().optional(),
      executionLog: z.string().optional(),
      authorizedAgentSignature: z.string().optional(),
    })
    .optional(),
});

function jsonWithHeaders(
  body: unknown,
  init: { status?: number; cache: 'edge' | 'no-store' },
): NextResponse {
  const response = NextResponse.json(body, { status: init.status ?? 200 });
  return init.cache === 'edge' ? applyEdgeMicroCache(response) : applyNoStore(response);
}

/** GET — cacheable capability + optional tool requirement lookup (edge micro-cache). */
export async function GET(req: NextRequest) {
  const toolName = req.nextUrl.searchParams.get('toolName')?.trim();

  const payload = {
    service: 'proof-verifier',
    version: '1',
    status: 'operational',
    supportedProofComponents: PROOF_COMPONENTS,
    actionCategories: ACTION_CATEGORIES,
    cachePolicy: 'public, s-maxage=60, stale-while-revalidate=30',
    ...(toolName
      ? {
          lookup: {
            toolName,
            note: 'Submit POST with evidence bundle for full cryptographic verification.',
          },
        }
      : {}),
  };

  return jsonWithHeaders(payload, { cache: 'edge' });
}

/** POST — verify action outcome; never cached. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return jsonWithHeaders(
        { error: 'Invalid proof verification payload', details: parsed.error.flatten() },
        { status: 400, cache: 'no-store' },
      );
    }

    const result = verifyActionOutcome(
      {
        toolName: parsed.data.toolName,
        actionType: parsed.data.actionType,
        agentId: parsed.data.agentId,
        args: parsed.data.args,
      },
      parsed.data.evidence,
    );

    recordOutcomeVerification(
      {
        toolName: parsed.data.toolName,
        actionType: parsed.data.actionType,
        agentId: parsed.data.agentId,
      },
      result,
    );

    return jsonWithHeaders(
      {
        service: 'proof-verifier',
        verifiedAt: new Date().toISOString(),
        input: {
          toolName: parsed.data.toolName,
          actionType: parsed.data.actionType,
          agentId: parsed.data.agentId,
        },
        result,
      },
      { cache: 'no-store' },
    );
  } catch (error) {
    return jsonWithHeaders(
      {
        error: 'Proof verification failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, cache: 'no-store' },
    );
  }
}

export async function PUT() {
  return jsonWithHeaders({ error: 'Method not allowed' }, { status: 405, cache: 'no-store' });
}

export async function DELETE() {
  return jsonWithHeaders({ error: 'Method not allowed' }, { status: 405, cache: 'no-store' });
}
