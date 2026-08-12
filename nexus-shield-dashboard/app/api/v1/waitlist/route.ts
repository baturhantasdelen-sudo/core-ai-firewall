import { NextRequest } from 'next/server';
import { handleWaitlistPost } from '@/lib/waitlist/handle-waitlist-post';

export const runtime = 'nodejs';

/** Versioned alias for external clients — same handler as `/api/waitlist`. */
export async function POST(req: NextRequest) {
  return handleWaitlistPost(req);
}
