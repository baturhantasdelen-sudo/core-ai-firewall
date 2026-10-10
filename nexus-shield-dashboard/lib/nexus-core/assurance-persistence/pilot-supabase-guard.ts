/**
 * Fail-closed pilot project identity checks for Supabase LIVE integration tests only.
 * Not used by production API routes or default assurance persistence.
 */

export class PilotSupabaseGuardError extends Error {
  readonly code = 'PILOT_SUPABASE_GUARD';

  constructor(message: string) {
    super(message);
    this.name = 'PilotSupabaseGuardError';
  }
}

export interface PilotSupabaseValidationSuccess {
  ok: true;
  projectRef: string;
}

export interface PilotSupabaseValidationFailure {
  ok: false;
  reason: string;
}

export type PilotSupabaseValidationResult =
  | PilotSupabaseValidationSuccess
  | PilotSupabaseValidationFailure;

const SUPABASE_PROJECT_HOST = /^[a-z0-9]+\.supabase\.co$/;
const PROJECT_REF_PATTERN = /^[a-z0-9]+$/;

/** Extract project ref from a canonical Supabase API URL (https://<ref>.supabase.co). */
export function extractSupabaseProjectRefFromUrl(rawUrl: string): { ref: string } | { error: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { error: 'SUPABASE_URL empty' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: 'SUPABASE_URL malformed' };
  }

  if (parsed.protocol !== 'https:') {
    return { error: 'SUPABASE_URL must use HTTPS' };
  }

  if (parsed.username || parsed.password) {
    return { error: 'SUPABASE_URL must not embed credentials' };
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) {
    return { error: 'localhost endpoints are not allowed for live integration' };
  }

  if (!SUPABASE_PROJECT_HOST.test(host)) {
    return { error: 'SUPABASE_URL must be a standard *.supabase.co project endpoint' };
  }

  const ref = host.slice(0, -'.supabase.co'.length);
  if (!ref || !PROJECT_REF_PATTERN.test(ref)) {
    return { error: 'invalid Supabase project reference in URL' };
  }

  return { ref };
}

/**
 * Validates live-test Supabase target against NEXUS_ASSURANCE_EXPECTED_PILOT_REF.
 * Requires explicit SUPABASE_URL (no NEXT_PUBLIC fallback).
 */
export function validatePilotSupabaseIdentity(
  env: NodeJS.ProcessEnv = process.env,
): PilotSupabaseValidationResult {
  const expectedRef = env.NEXUS_ASSURANCE_EXPECTED_PILOT_REF?.trim();
  if (!expectedRef) {
    return { ok: false, reason: 'NEXUS_ASSURANCE_EXPECTED_PILOT_REF missing' };
  }
  if (!PROJECT_REF_PATTERN.test(expectedRef)) {
    return { ok: false, reason: 'NEXUS_ASSURANCE_EXPECTED_PILOT_REF malformed' };
  }

  const supabaseUrl = env.SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    if (env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
      return {
        ok: false,
        reason:
          'SUPABASE_URL required for live integration (NEXT_PUBLIC_SUPABASE_URL is not accepted as fallback)',
      };
    }
    return { ok: false, reason: 'SUPABASE_URL missing' };
  }

  const extracted = extractSupabaseProjectRefFromUrl(supabaseUrl);
  if ('error' in extracted) {
    return { ok: false, reason: extracted.error };
  }

  if (extracted.ref !== expectedRef) {
    return { ok: false, reason: 'SUPABASE_URL project reference does not match expected pilot ref' };
  }

  return { ok: true, projectRef: extracted.ref };
}

export function assertPilotSupabaseForLiveIntegrationOrThrow(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const result = validatePilotSupabaseIdentity(env);
  if (!result.ok) {
    throw new PilotSupabaseGuardError(result.reason);
  }
  return result.projectRef;
}
