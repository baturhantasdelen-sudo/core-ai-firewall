import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { evaluateChallengeLevel, type ChallengeLevelId } from '@/lib/challenge-engine';

export const runtime = 'nodejs';

const schema = z.object({
  levelId: z.number().int().min(1).max(7),
  payload: z.string().min(1).max(20_000),
  agentEndpoint: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid challenge payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = evaluateChallengeLevel(
      parsed.data.levelId as ChallengeLevelId,
      parsed.data.payload,
      parsed.data.agentEndpoint,
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Challenge evaluation failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
