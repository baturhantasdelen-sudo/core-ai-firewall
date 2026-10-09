import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryAssurancePersistence } from '@/lib/nexus-core/assurance-persistence/memory';
import { SqliteAssurancePersistence } from '@/lib/nexus-core/assurance-persistence/sqlite';
import {
  PersistenceUnavailableError,
  type AssurancePersistence,
} from '@/lib/nexus-core/assurance-persistence/types';

let active: AssurancePersistence | null = null;
let sqlitePath: string | null = null;

export function resolveDefaultSqlitePath(): string {
  const configured = process.env.NEXUS_ASSURANCE_SQLITE_PATH?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new PersistenceUnavailableError(
      'Production requires NEXUS_ASSURANCE_SQLITE_PATH or NEXUS_ASSURANCE_USE_SUPABASE=true with schema-assurance.sql applied',
    );
  }
  const dir = join(process.cwd(), '.data');
  mkdirSync(dir, { recursive: true });
  return join(dir, 'nexus-assurance.sqlite');
}

function closeActiveSqlite(): void {
  if (active instanceof SqliteAssurancePersistence) {
    active.close();
  }
}

export function initAssurancePersistence(options?: {
  mode?: 'memory' | 'sqlite';
  sqlitePath?: string;
}): AssurancePersistence {
  closeActiveSqlite();
  if (options?.mode === 'memory') {
    active = new MemoryAssurancePersistence();
    sqlitePath = null;
    return active;
  }
  const path = options?.sqlitePath ?? resolveDefaultSqlitePath();
  sqlitePath = path;
  active = new SqliteAssurancePersistence(path);
  return active;
}

export function getAssurancePersistence(): AssurancePersistence {
  if (active) return active;
  if (process.env.NEXUS_ASSURANCE_ALLOW_MEMORY === 'true' && process.env.NODE_ENV === 'test') {
    active = new MemoryAssurancePersistence();
    return active;
  }
  if (process.env.NODE_ENV === 'test') {
    active = new MemoryAssurancePersistence();
    return active;
  }
  return initAssurancePersistence();
}

export function getSqlitePathForTests(): string | null {
  return sqlitePath;
}

export function reopenSqlitePersistence(): AssurancePersistence {
  if (!sqlitePath) throw new Error('No sqlite path configured');
  closeActiveSqlite();
  active = new SqliteAssurancePersistence(sqlitePath);
  return active;
}

export function resetAssurancePersistenceForTests(): void {
  active?.resetForTests();
  closeActiveSqlite();
  active = null;
}

export function setAssurancePersistenceForTests(persistence: AssurancePersistence): void {
  active = persistence;
}

export * from '@/lib/nexus-core/assurance-persistence/types';
export * from '@/lib/nexus-core/assurance-persistence/fingerprint';
export * from '@/lib/nexus-core/assurance-persistence/provenance';
export { MemoryAssurancePersistence } from '@/lib/nexus-core/assurance-persistence/memory';
export { SqliteAssurancePersistence } from '@/lib/nexus-core/assurance-persistence/sqlite';
