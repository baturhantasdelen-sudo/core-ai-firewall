import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const orgId = process.argv[2];

if (!orgId) {
  console.error('Usage: node scripts/check-org-status.mjs <org_id>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase
  .from('organizations')
  .select('id, name, stripe_subscription_status, stripe_customer_id, created_at')
  .eq('id', orgId)
  .single();

if (error) {
  console.error('Query failed:', error.message);
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
