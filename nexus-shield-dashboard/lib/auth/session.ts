import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureUserOrganization } from '@/lib/auth/ensure-org';
import type { OrgRecord } from '@/lib/org-metrics';

export interface AuthContext {
  userId: string;
  email: string;
  org: OrgRecord;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) return null;

    const org = await ensureUserOrganization(user.id, user.email);
    return { userId: user.id, email: user.email, org };
  } catch {
    return null;
  }
}

export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) {
    throw new Error('Unauthorized');
  }
  return ctx;
}
