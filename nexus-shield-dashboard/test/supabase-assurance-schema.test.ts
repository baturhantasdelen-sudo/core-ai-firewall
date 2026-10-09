import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { resolveAssuranceBackend } from '@/lib/nexus-core/assurance-persistence/config';

describe('Supabase assurance schema (static validation)', () => {
  it('schema-assurance.sql enables RLS on assurance tables', () => {
    const sql = readFileSync(join(process.cwd(), 'schema-assurance.sql'), 'utf8');
    assert.match(sql, /assurance_verifications enable row level security/);
    assert.match(sql, /primary key \(org_id, idempotency_key\)/);
  });

  it('schema-assurance-atomic.sql defines assurance_save_bundle RPC', () => {
    const sql = readFileSync(join(process.cwd(), 'schema-assurance-atomic.sql'), 'utf8');
    assert.match(sql, /function public\.assurance_save_bundle/);
    assert.match(sql, /security definer/);
    assert.match(sql, /set search_path = public/);
    assert.match(sql, /revoke all on function public\.assurance_save_bundle/);
    assert.match(sql, /grant execute on function public\.assurance_save_bundle.*service_role/);
    assert.match(sql, /assurance_idempotency_conflict/);
  });
});

describe('Assurance configuration (no secrets logged)', () => {
  it('defaults to sqlite ok in non-production test env', () => {
    const prev = { ...process.env };
    process.env.NODE_ENV = 'test';
    delete process.env.NEXUS_ASSURANCE_USE_SUPABASE;
    const s = resolveAssuranceBackend();
    assert.equal(s.ok, true);
    assert.equal(s.backend, 'sqlite');
    process.env = prev;
  });

  it('fails closed when supabase flag set without credentials', () => {
    const prev = { ...process.env };
    process.env.NEXUS_ASSURANCE_USE_SUPABASE = 'true';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const s = resolveAssuranceBackend();
    assert.equal(s.ok, false);
    process.env = prev;
  });
});
