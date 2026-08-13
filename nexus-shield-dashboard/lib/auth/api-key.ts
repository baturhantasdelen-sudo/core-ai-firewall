import type { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { OrgRecord } from '@/lib/org-metrics';

const API_KEY_HEADERS = ['x-api-key', 'x-nexus-api-key'] as const;

export function extractApiKey(req: NextRequest): string | null {
  for (const header of API_KEY_HEADERS) {
    const value = req.headers.get(header)?.trim();
    if (value) return value;
  }
  return null;
}

export async function authenticateApiKey(apiKey: string): Promise<OrgRecord | null> {
  if (!apiKey.startsWith('nex_')) {
    return null;
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('organizations')
    .select(
      'id, name, stripe_customer_id, stripe_subscription_status, monthly_scan_limit, github_installation_id, api_key',
    )
    .eq('api_key', apiKey)
    .maybeSingle<OrgRecord>();

  if (error) {
    throw new Error(`Failed to verify API key: ${error.message}`);
  }

  return data;
}
