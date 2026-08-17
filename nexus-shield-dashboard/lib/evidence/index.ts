import {
  generateEvidenceBundle,
  sha256,
  verifyBundleSignature,
} from '@/lib/evidence/generator';
import {
  buildEvidenceMerkleTree,
  verifyBundleInTree,
  verifyEvidenceProof,
} from '@/lib/evidence/merkle';
import type {
  EvidenceBundle,
  EvidenceBundleInput,
  EvidenceMerkleTree,
  EvidenceVerificationResult,
  MerkleProof,
} from '@/lib/evidence/types';

export type {
  EvidenceBundle,
  EvidenceBundleInput,
  EvidenceMerkleTree,
  EvidenceStatus,
  EvidenceVerificationResult,
  MerkleProof,
} from '@/lib/evidence/types';

export {
  isUnverifiedBundle,
  isVerifiedBundle,
} from '@/lib/evidence/types';

export {
  generateEvidenceBundle,
  hashBundleLeaf,
  markBundleTampered,
  sha256,
  verifyBundleSignature,
} from '@/lib/evidence/generator';

export {
  buildEvidenceMerkleTree,
  generateMerkleProof,
  verifyBundleInTree,
  verifyEvidenceProof,
} from '@/lib/evidence/merkle';

/** Demo bundles for dashboard — mix of VERIFIED and UNVERIFIED actions. */
export function buildMockEvidenceBundles(): EvidenceBundle[] {
  return [
    generateEvidenceBundle({
      agentId: 'langchain-support-agent-1',
      actionType: 'READ_INVOICE',
      requestPayload: { tool: 'read_invoice', invoiceId: 'INV-8291' },
      responsePayload: { status: 'ok', rows: 1 },
      dbTxId: 'TXN-READ-8291',
      trajectoryHash: sha256('traj-read-invoice'),
    }),
    generateEvidenceBundle({
      agentId: 'crewai-ops-agent-1',
      actionType: 'FINANCIAL_TRANSFER',
      requestPayload: { tool: 'stripe_transfer', amount: 5000 },
      responsePayload: { status: 'pending' },
    }),
    generateEvidenceBundle({
      agentId: 'openai-assistant-1',
      actionType: 'BULK_EXPORT',
      requestPayload: { tool: 'bulk_export_db', table: 'customers' },
      responsePayload: { exportedRows: 1200 },
      dbTxId: 'TXN-EXP-4421',
      trajectoryHash: sha256('traj-bulk-export'),
    }),
    generateEvidenceBundle({
      agentId: 'rogue-shadow-agent-1',
      actionType: 'EXTERNAL_API_CALL',
      requestPayload: { url: 'https://unknown.host/exfil' },
      responsePayload: { bytes: 4096 },
    }),
  ];
}

let cachedTree: EvidenceMerkleTree | null = null;

export function getOrBuildEvidenceMerkleTree(bundles?: EvidenceBundle[]): EvidenceMerkleTree {
  if (bundles) {
    cachedTree = buildEvidenceMerkleTree(bundles);
    return cachedTree;
  }
  if (!cachedTree) {
    cachedTree = buildEvidenceMerkleTree(buildMockEvidenceBundles());
  }
  return cachedTree;
}

export function verifyEvidenceBundle(
  bundle: EvidenceBundle,
  tree?: EvidenceMerkleTree,
): EvidenceVerificationResult {
  const merkleTree = tree ?? getOrBuildEvidenceMerkleTree();
  const signatureValid = verifyBundleSignature(bundle);
  const { valid: merkleValid } = verifyBundleInTree(bundle, merkleTree);

  let status = bundle.status;
  if (!signatureValid) status = 'TAMPERED';
  else if (bundle.status === 'UNVERIFIED') status = 'UNVERIFIED';
  else if (merkleValid && signatureValid) status = 'VERIFIED';

  const valid = status === 'VERIFIED' && signatureValid && merkleValid;

  return {
    valid,
    status,
    bundleId: bundle.bundleId,
    rootHash: merkleTree.rootHash,
    signatureValid,
    merkleValid,
    reason: valid
      ? 'Cryptographic signature and Merkle proof verified'
      : !signatureValid
        ? 'Signature mismatch — possible tampering'
        : !merkleValid
          ? 'Merkle proof failed — bundle not in immutable chain'
          : 'Evidence incomplete — manual review required',
  };
}

export function resetEvidenceMerkleCache(): void {
  cachedTree = null;
}
