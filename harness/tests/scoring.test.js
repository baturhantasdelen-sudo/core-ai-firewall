import assert from 'node:assert/strict';
import test from 'node:test';
import { compareToProofCenterBaseline } from '../dist/scoring/baseline.js';
import { isBlockedDecision, summarizeOutcomes } from '../dist/scoring/evidence.js';
import { percentile } from '../dist/scoring/latency.js';

test('percentile computes p95', () => {
  assert.equal(percentile([1, 2, 3, 4, 100], 95), 100);
});

test('blocked decisions include approval states', () => {
  assert.equal(isBlockedDecision('BLOCK'), true);
  assert.equal(isBlockedDecision('PENDING_APPROVAL'), true);
  assert.equal(isBlockedDecision('ALLOW'), false);
});

test('baseline comparison flags meeting 99.3%', () => {
  const result = compareToProofCenterBaseline(100);
  assert.equal(result.meetsBaseline, true);
  assert.equal(result.proofCenterBlockRatePct, 99.3);
});

test('summarize outcomes computes block rate', () => {
  const summary = summarizeOutcomes([
    { blocked: true },
    { blocked: false },
  ]);
  assert.equal(summary.blockedCount, 1);
  assert.equal(summary.blockRatePct, 50);
});
