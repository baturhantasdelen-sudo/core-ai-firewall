import { randomBytes } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { OrgRecord } from '@/lib/org-metrics';
import { PLAN_SCAN_LIMITS } from '@/config/plans';

function generateApiKey(): string {
  return `nex_${randomBytes(24).toString('hex')}`;
}

export async function ensureUserOrganization(
  userId: string,
  email: string,
): Promise<OrgRecord> {
  const supabase = getSupabaseAdmin();

  const { data: membership, error: memberError } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .maybeSingle<{ org_id: string }>();

  if (memberError) {
    throw new Error(`Failed to lookup org membership: ${memberError.message}`);
  }

  if (membership?.org_id) {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select(
        'id, name, stripe_customer_id, stripe_subscription_status, monthly_scan_limit, github_installation_id, api_key',
      )
      .eq('id', membership.org_id)
      .maybeSingle<OrgRecord>();

    if (orgError) throw new Error(orgError.message);
    if (org) return org;
  }

  const orgName = email.split('@')[0] || 'My Organization';

  const { data: newOrg, error: createError } = await supabase
    .from('organizations')
    .insert({
      name: orgName,
      api_key: generateApiKey(),
      monthly_scan_limit: PLAN_SCAN_LIMITS.free,
      stripe_subscription_status: 'free',
    })
    .select(
      'id, name, stripe_customer_id, stripe_subscription_status, monthly_scan_limit, github_installation_id, api_key',
    )
    .single<OrgRecord>();

  if (createError || !newOrg) {
    throw new Error(createError?.message ?? 'Failed to create organization');
  }

  const { error: linkError } = await supabase.from('org_members').insert({
    org_id: newOrg.id,
    user_id: userId,
    role: 'owner',
  });

  if (linkError) {
    throw new Error(`Failed to link user to organization: ${linkError.message}`);
  }

  return newOrg;
}
