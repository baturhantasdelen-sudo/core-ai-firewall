import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  PilotSupabaseGuardError,
  assertPilotSupabaseForLiveIntegrationOrThrow,
  extractSupabaseProjectRefFromUrl,
  validatePilotSupabaseIdentity,
} from '@/lib/nexus-core/assurance-persistence/pilot-supabase-guard';
import { isSupabaseLiveIntegrationEnabled } from '@/lib/nexus-core/assurance-persistence/config';

const PILOT_REF = 'abcdefghijklmnop1234';
const PRODUCTION_REF = 'zzzzzzzzzzzzzzzzprod';
const pilotUrl = `https://${PILOT_REF}.supabase.co`;
const productionUrl = `https://${PRODUCTION_REF}.supabase.co`;

function baseLiveEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NEXUS_ASSURANCE_LIVE_INTEGRATION: 'true',
    NEXUS_ASSURANCE_USE_SUPABASE: 'true',
    NEXUS_ASSURANCE_EXPECTED_PILOT_REF: PILOT_REF,
    SUPABASE_URL: pilotUrl,
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-not-real',
    ...overrides,
  };
}

describe('pilot Supabase guard (offline)', () => {
  it('missing expected pilot ref fails closed', () => {
    const env = baseLiveEnv({ NEXUS_ASSURANCE_EXPECTED_PILOT_REF: undefined });
    const result = validatePilotSupabaseIdentity(env);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.reason, /NEXUS_ASSURANCE_EXPECTED_PILOT_REF missing/);
    assert.throws(
      () => assertPilotSupabaseForLiveIntegrationOrThrow(env),
      PilotSupabaseGuardError,
    );
  });

  it('missing SUPABASE_URL fails closed', () => {
    const env = baseLiveEnv({ SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_URL: undefined });
    const result = validatePilotSupabaseIdentity(env);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.reason, /SUPABASE_URL missing/);
  });

  it('rejects NEXT_PUBLIC_SUPABASE_URL as implicit fallback when SUPABASE_URL unset', () => {
    const env = baseLiveEnv({
      SUPABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_URL: pilotUrl,
    });
    const result = validatePilotSupabaseIdentity(env);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.reason, /NEXT_PUBLIC_SUPABASE_URL is not accepted/);
  });

  it('wrong project ref fails closed', () => {
    const env = baseLiveEnv({
      SUPABASE_URL: productionUrl,
      NEXUS_ASSURANCE_EXPECTED_PILOT_REF: PILOT_REF,
    });
    const result = validatePilotSupabaseIdentity(env);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.reason, /does not match expected pilot ref/);
  });

  it('production URL paired with pilot ref fails closed', () => {
    const env = baseLiveEnv({
      SUPABASE_URL: productionUrl,
      NEXUS_ASSURANCE_EXPECTED_PILOT_REF: PILOT_REF,
    });
    assert.equal(validatePilotSupabaseIdentity(env).ok, false);
    const prev = { ...process.env };
    try {
      Object.assign(process.env, env);
      assert.equal(isSupabaseLiveIntegrationEnabled(), false);
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in prev)) delete process.env[key];
      }
      Object.assign(process.env, prev);
    }
  });

  it('malformed URL fails closed', () => {
    for (const badUrl of [
      'not-a-url',
      'http://abcdef.supabase.co',
      'https://localhost/supabase',
      'https://127.0.0.1:54321',
      'https://evil.example.com',
      'https://abcdef.supabase.co.evil.com',
    ]) {
      const extracted = extractSupabaseProjectRefFromUrl(badUrl);
      assert.ok('error' in extracted, `expected error for ${badUrl}`);
      const env = baseLiveEnv({ SUPABASE_URL: badUrl });
      assert.equal(validatePilotSupabaseIdentity(env).ok, false);
    }
  });

  it('correct pilot URL and ref passes', () => {
    const env = baseLiveEnv();
    const result = validatePilotSupabaseIdentity(env);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.projectRef, PILOT_REF);
    assert.equal(assertPilotSupabaseForLiveIntegrationOrThrow(env), PILOT_REF);
  });

  it('live integration gate requires pilot guard and service role', () => {
    const prev = { ...process.env };
    try {
      Object.assign(process.env, baseLiveEnv());
      assert.equal(isSupabaseLiveIntegrationEnabled(), true);
      delete process.env.NEXUS_ASSURANCE_EXPECTED_PILOT_REF;
      assert.equal(isSupabaseLiveIntegrationEnabled(), false);
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in prev)) delete process.env[key];
      }
      Object.assign(process.env, prev);
    }
  });

  it('rejected configuration must not reach getSupabaseAdmin in live test wiring', () => {
    const env = baseLiveEnv({ NEXUS_ASSURANCE_EXPECTED_PILOT_REF: undefined });
    assert.throws(
      () => assertPilotSupabaseForLiveIntegrationOrThrow(env),
      PilotSupabaseGuardError,
    );

    const src = readFileSync(
      join(process.cwd(), 'test/supabase-assurance-live.integration.test.ts'),
      'utf8',
    );
    const guardCall = 'assertPilotSupabaseForLiveIntegrationOrThrow()';
    const guardIdx = src.indexOf(guardCall);
    const beforeAdminIdx = src.indexOf('getSupabaseAdmin()', guardIdx);
    assert.ok(guardIdx >= 0, 'live test must call pilot guard');
    assert.ok(beforeAdminIdx > guardIdx, 'pilot guard must run before getSupabaseAdmin in before()');
    const afterHook = src.slice(src.indexOf('after(async'));
    const afterGuard = afterHook.indexOf(guardCall);
    const afterAdmin = afterHook.indexOf('getSupabaseAdmin()');
    assert.ok(afterGuard >= 0 && afterAdmin > afterGuard, 'after() must guard before delete');
  });
});
