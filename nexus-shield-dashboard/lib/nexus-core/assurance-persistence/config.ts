import { PersistenceUnavailableError } from '@/lib/nexus-core/assurance-persistence/types';

export interface AssuranceConfigStatus {
  backend: 'sqlite' | 'supabase' | 'memory';
  ok: boolean;
  reason?: string;
}

/** Fail-closed configuration check — never logs secret values. */
export function resolveAssuranceBackend(): AssuranceConfigStatus {
  const useSupabase = process.env.NEXUS_ASSURANCE_USE_SUPABASE === 'true';
  const isProd = process.env.NODE_ENV === 'production';

  if (useSupabase) {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url?.trim()) {
      return { backend: 'supabase', ok: false, reason: 'SUPABASE_URL missing' };
    }
    if (!key?.trim()) {
      return { backend: 'supabase', ok: false, reason: 'SUPABASE_SERVICE_ROLE_KEY missing' };
    }
    return { backend: 'supabase', ok: true };
  }

  if (isProd) {
    const sqlitePath = process.env.NEXUS_ASSURANCE_SQLITE_PATH?.trim();
    if (!sqlitePath) {
      return {
        backend: 'sqlite',
        ok: false,
        reason: 'Production requires NEXUS_ASSURANCE_USE_SUPABASE=true or NEXUS_ASSURANCE_SQLITE_PATH',
      };
    }
    return { backend: 'sqlite', ok: true };
  }

  return { backend: 'sqlite', ok: true };
}

export function assertAssuranceConfigOrThrow(): AssuranceConfigStatus {
  const status = resolveAssuranceBackend();
  if (!status.ok) {
    throw new PersistenceUnavailableError(status.reason ?? 'Assurance persistence not configured');
  }
  return status;
}

export function isSupabaseLiveIntegrationEnabled(): boolean {
  return (
    process.env.NEXUS_ASSURANCE_LIVE_INTEGRATION === 'true' &&
    process.env.NEXUS_ASSURANCE_USE_SUPABASE === 'true' &&
    resolveAssuranceBackend().ok
  );
}
