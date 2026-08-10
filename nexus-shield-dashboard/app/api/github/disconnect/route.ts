import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const disconnectRequestSchema = z.object({
  org_id: z.string().uuid('org_id must be a valid UUID'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = disconnectRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { error, data } = await supabase
      .from('organizations')
      .update({ github_installation_id: null })
      .eq('id', parsed.data.org_id)
      .select('id')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
