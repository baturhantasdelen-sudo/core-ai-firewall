import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const name = process.argv[2] ?? 'Test Org';
const apiKey = `nex_test_${randomBytes(16).toString('hex')}`;

const { data, error } = await supabase
  .from('organizations')
  .insert({ name, stripe_subscription_status: 'free', api_key: apiKey })
  .select('id, name, stripe_subscription_status, api_key, created_at')
  .single();

if (error) {
  console.error('Insert failed:', error.message);
  process.exit(1);
}

console.log(JSON.stringify(data, null, 2));
