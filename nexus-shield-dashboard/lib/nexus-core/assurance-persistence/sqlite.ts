import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Evidence, VerificationResult } from '@/lib/nexus-core/outcome/models';
import {
  IdempotencyConflictError,
  type AssurancePersistence,
  type AssuranceUarRecord,
  type IdempotencyRecord,
  type PersistScope,
  type StoredVerification,
} from '@/lib/nexus-core/assurance-persistence/types';
import { incrementAssurancePersistenceMetric } from '@/lib/nexus-core/assurance-persistence/metrics';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS assurance_verifications (
  verification_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL,
  verification_state TEXT NOT NULL,
  record_provenance TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_av_org ON assurance_verifications(org_id);
CREATE INDEX IF NOT EXISTS idx_av_org_action ON assurance_verifications(org_id, action_id);

CREATE TABLE IF NOT EXISTS assurance_evidence (
  evidence_id TEXT PRIMARY KEY,
  verification_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (verification_id) REFERENCES assurance_verifications(verification_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ae_verification ON assurance_evidence(verification_id);

CREATE TABLE IF NOT EXISTS assurance_uar (
  uar_id TEXT PRIMARY KEY,
  verification_id TEXT NOT NULL UNIQUE,
  org_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (verification_id) REFERENCES assurance_verifications(verification_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assurance_idempotency (
  org_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  verification_id TEXT NOT NULL,
  PRIMARY KEY (org_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS assurance_lifecycle_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  verification_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  event_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export class SqliteAssurancePersistence implements AssurancePersistence {
  readonly mode = 'sqlite' as const;
  private db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  saveBundle(scope: PersistScope, result: VerificationResult, uarPayload: Record<string, unknown>): void {
    if (result.idempotency_key) {
      const existing = this.findIdempotency(scope.org_id, result.idempotency_key);
      if (existing) {
        if (existing.request_fingerprint !== scope.request_fingerprint) {
          incrementAssurancePersistenceMetric('idempotency_conflict_total');
          throw new IdempotencyConflictError('Idempotency key reused with different payload');
        }
        return;
      }
    }

    const stored: StoredVerification = {
      ...result,
      org_id: scope.org_id,
      record_provenance: scope.record_provenance,
    };

    this.db.exec('BEGIN');
    try {
      this.db
        .prepare(
          `INSERT INTO assurance_verifications
          (verification_id, org_id, action_id, agent_id, status, verification_state, record_provenance, payload_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          result.verification_id,
          scope.org_id,
          scope.action_id,
          scope.agent_id,
          result.status,
          result.verification_state,
          scope.record_provenance,
          JSON.stringify(stored),
        );

      const insEv = this.db.prepare(
        `INSERT INTO assurance_evidence (evidence_id, verification_id, org_id, payload_json) VALUES (?, ?, ?, ?)`,
      );
      for (const ev of result.evidence) {
        insEv.run(ev.evidence_id, result.verification_id, scope.org_id, JSON.stringify(ev));
      }

      const uar_id = `uar_${result.verification_id}`;
      const uarRecord: AssuranceUarRecord = {
        uar_id,
        verification_id: result.verification_id,
        org_id: scope.org_id,
        uar_version: '2.0',
        verification_status: result.status,
        payload: uarPayload,
        integrity_hash: createHash('sha256').update(JSON.stringify(uarPayload)).digest('hex'),
      };
      this.db
        .prepare(`INSERT INTO assurance_uar (uar_id, verification_id, org_id, payload_json) VALUES (?, ?, ?, ?)`)
        .run(uar_id, result.verification_id, scope.org_id, JSON.stringify(uarRecord));

      if (result.idempotency_key) {
        this.db
          .prepare(
            `INSERT INTO assurance_idempotency (org_id, idempotency_key, request_fingerprint, verification_id)
             VALUES (?, ?, ?, ?)`,
          )
          .run(scope.org_id, result.idempotency_key, scope.request_fingerprint, result.verification_id);
      }

      this.db
        .prepare(
          `INSERT INTO assurance_lifecycle_events (verification_id, org_id, from_state, to_state) VALUES (?, ?, ?, ?)`,
        )
        .run(result.verification_id, scope.org_id, 'EXPECTED', result.verification_state);

      this.db.exec('COMMIT');
      incrementAssurancePersistenceMetric('persistence_commit_total');
    } catch (err) {
      this.db.exec('ROLLBACK');
      incrementAssurancePersistenceMetric('persistence_rollback_total');
      throw err;
    }
  }

  getVerification(org_id: string, verification_id: string): StoredVerification | undefined {
    const row = this.db
      .prepare(`SELECT payload_json, org_id FROM assurance_verifications WHERE verification_id = ?`)
      .get(verification_id) as { payload_json: string; org_id: string } | undefined;
    if (!row || row.org_id !== org_id) return undefined;
    return JSON.parse(row.payload_json) as StoredVerification;
  }

  getEvidence(org_id: string, verification_id: string): Evidence[] {
    if (!this.getVerification(org_id, verification_id)) return [];
    const rows = this.db
      .prepare(`SELECT payload_json, org_id FROM assurance_evidence WHERE verification_id = ?`)
      .all(verification_id) as Array<{ payload_json: string; org_id: string }>;
    return rows.filter((r) => r.org_id === org_id).map((r) => JSON.parse(r.payload_json) as Evidence);
  }

  getUar(org_id: string, verification_id: string): AssuranceUarRecord | undefined {
    if (!this.getVerification(org_id, verification_id)) return undefined;
    const row = this.db
      .prepare(`SELECT payload_json, org_id FROM assurance_uar WHERE verification_id = ?`)
      .get(verification_id) as { payload_json: string; org_id: string } | undefined;
    if (!row || row.org_id !== org_id) return undefined;
    return JSON.parse(row.payload_json) as AssuranceUarRecord;
  }

  findIdempotency(org_id: string, idempotency_key: string): IdempotencyRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT request_fingerprint, verification_id FROM assurance_idempotency WHERE org_id = ? AND idempotency_key = ?`,
      )
      .get(org_id, idempotency_key) as { request_fingerprint: string; verification_id: string } | undefined;
    if (!row) return undefined;
    return row;
  }

  resetForTests(): void {
    this.db.exec(`
      DELETE FROM assurance_lifecycle_events;
      DELETE FROM assurance_idempotency;
      DELETE FROM assurance_uar;
      DELETE FROM assurance_evidence;
      DELETE FROM assurance_verifications;
    `);
  }
}
