import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  buildEvidenceMerkleTree,
  buildMockEvidenceBundles,
  generateEvidenceBundle,
  generateMerkleProof,
  markBundleTampered,
  resetEvidenceMerkleCache,
  verifyEvidenceProof,
  verifyEvidenceBundle,
  verifyBundleSignature,
} from '../lib/evidence/index.ts';

describe('P1 Evidence Engine', () => {
  afterEach(() => {
    resetEvidenceMerkleCache();
  });

  it('generateEvidenceBundle produces SHA-256 signature and VERIFIED status when complete', () => {
    const bundle = generateEvidenceBundle({
      agentId: 'agent-1',
      actionType: 'FINANCIAL_TRANSFER',
      requestPayload: { amount: 100 },
      responsePayload: { status: 'ok' },
      dbTxId: 'TXN-001',
    });

    assert.ok(bundle.bundleId.startsWith('evb_'));
    assert.equal(bundle.status, 'VERIFIED');
    assert.ok(verifyBundleSignature(bundle));
    assert.ok(bundle.cryptographicSignature.length >= 64);
  });

  it('marks financial actions UNVERIFIED without dbTxId', () => {
    const bundle = generateEvidenceBundle({
      agentId: 'agent-2',
      actionType: 'PAYMENT',
      requestPayload: { x: 1 },
      responsePayload: { y: 2 },
    });
    assert.equal(bundle.status, 'UNVERIFIED');
  });
});

describe('P1 Merkle Immutability Layer', () => {
  afterEach(() => {
    resetEvidenceMerkleCache();
  });

  it('buildEvidenceMerkleTree and verifyEvidenceProof validate inclusion', () => {
    const bundles = buildMockEvidenceBundles();
    const tree = buildEvidenceMerkleTree(bundles);
    assert.ok(tree.rootHash.length >= 64);
    assert.equal(tree.leafCount, bundles.length);

    const proof = generateMerkleProof(tree, bundles[0]!);
    assert.ok(proof);
    assert.equal(verifyEvidenceProof(proof!), true);
  });

  it('detects tampered bundle via signature verification', () => {
    const bundle = generateEvidenceBundle({
      agentId: 'agent-tamper',
      actionType: 'READ',
      requestPayload: { a: 1 },
      responsePayload: { b: 2 },
      dbTxId: 'TXN-T',
    });
    const tree = buildEvidenceMerkleTree([bundle]);
    const tampered = markBundleTampered(bundle);
    const result = verifyEvidenceBundle(tampered, tree);
    assert.equal(result.valid, false);
    assert.equal(result.signatureValid, false);
  });
});
