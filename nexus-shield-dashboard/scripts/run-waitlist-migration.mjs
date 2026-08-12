/**
 * Idempotent waitlist table migration + verification.
 *
 * Usage (from nexus-shield-dashboard/):
 *   node scripts/run-waitlist-migration.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
 * in .env.local. Optional: SUPABASE_DB_URL or DATABASE_URL for direct DDL via pg.
 */

import { createClient } from '@supabase/supabase-js';
import nextEnv from '@next/env';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

nextEnv.loadEnvConfig(projectRoot);

const WAITLIST_SQL = `
create extension if not exists "pgcrypto";

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;
`.trim();

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function runViaPg() {
  if (!dbUrl) {
    return false;
  }

  let pg;
  try {
    pg = await import('pg');
  } catch {
    console.warn('pg package not installed — skipping direct DDL. Set SUPABASE_DB_URL and run: npm install pg');
    return false;
  }

  const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(WAITLIST_SQL);
    console.log('✅ DDL applied via postgres connection');
    return true;
  } finally {
    await client.end();
  }
}

async function verifyTable(supabase) {
  const { count, error } = await supabase.from('waitlist').select('*', { count: 'exact', head: true });

  if (error) {
    return { ok: false, error };
  }

  return { ok: true, count: count ?? 0 };
}

async function main() {
  console.log('--- Waitlist migration ---');

  const ddlApplied = await runViaPg();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let verification = await verifyTable(supabase);

  if (!verification.ok && !ddlApplied) {
    console.error('\n❌ waitlist table missing:', verification.error.message);
    console.error('\nRun this SQL in Supabase → SQL Editor:\n');
    console.error(WAITLIST_SQL);
    console.error('\nOr set SUPABASE_DB_URL in .env.local and re-run this script.');
    process.exit(1);
  }

  if (verification.ok) {
    console.log(`✅ waitlist table ready (${verification.count} row(s))`);
  }

  console.log('Migration complete.');
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
