import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase';

const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi girin.'),
});

export async function handleWaitlistPost(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => null);
    const parsed = waitlistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Geçersiz istek.' },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('waitlist').insert({ email: parsed.data.email });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: true, alreadyJoined: true }, { status: 200 });
      }

      console.error('[waitlist] insert error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      return NextResponse.json({ error: 'Kayıt oluşturulamadı, lütfen tekrar deneyin.' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[waitlist] unexpected error:', message);
    return NextResponse.json({ error: 'Sunucu hatası, lütfen tekrar deneyin.' }, { status: 500 });
  }
}
