import { NextRequest } from 'next/server';
import { handleWaitlistPost } from '@/lib/waitlist/handle-waitlist-post';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return handleWaitlistPost(req);
}
