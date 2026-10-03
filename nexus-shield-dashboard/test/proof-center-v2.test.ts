import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  DEMO_AAR_RECEIPTS,
  DEMO_BLAST_RADIUS,
  DEMO_DELEGATION,
  filterReceiptsByStatus,
} from '../lib/proof-center/accountability-demo.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Proof Center v2 accountability UI data', () => {
  it('includes verified, unverified, and failed AAR samples', () => {
    const statuses = DEMO_AAR_RECEIPTS.map((r) => r.outcome_verification.status);
    assert.ok(statuses.includes('VERIFIED'));
    assert.ok(statuses.includes('UNVERIFIED'));
    assert.ok(statuses.includes('FAILED'));
  });

  it('filters receipts by verification status', () => {
    const verified = filterReceiptsByStatus(DEMO_AAR_RECEIPTS, 'VERIFIED');
    assert.ok(verified.every((r) => r.outcome_verification.status === 'VERIFIED'));
  });

  it('exports Action Verification Center components', () => {
    const root = join(__dirname, '../components/proof-center');
    for (const file of ['ReceiptInspector.tsx', 'BlastRadiusMatrix.tsx', 'DelegationTree.tsx', 'ActionVerificationCenter.tsx']) {
      const src = readFileSync(join(root, file), 'utf8');
      assert.match(src, /export function/);
    }
  });

  it('blast radius demo includes exposure map and tier', () => {
    assert.ok(DEMO_BLAST_RADIUS.score > 0);
    assert.ok(Object.keys(DEMO_BLAST_RADIUS.exposure_map).length >= 2);
  });

  it('delegation demo includes blocked escalation audit', () => {
    assert.ok(DEMO_DELEGATION.nodes.some((n) => n.blocked));
    assert.ok(DEMO_DELEGATION.audit.length >= 1);
  });
});
