import { resolveAuthoritativeVertical } from '@/lib/nexus-core/assurance/authoritative-sources';
import type { ProofClaimEvidence, ProofIntegrityChecks, TransactionProofBundle } from '@/lib/nexus-core/proof/types';
import { sha256Canonical } from '@/lib/nexus-core/outcome/evidence';
import type { Uar20Receipt } from '@/lib/nexus-core/uar/models';
import { verifyUar20Receipt } from '@/lib/nexus-core/uar/verify';

function buildClaims(receipt: Uar20Receipt): ProofClaimEvidence[] {
  const actual = receipt.actual_outcome?.actual_state ?? receipt.actual_outcome?.expected_state ?? {};
  const expected = receipt.expected_outcome.expected_state;
  const claims: ProofClaimEvidence[] = [];

  for (const [field, exp] of Object.entries(expected)) {
    const act = actual[field];
    claims.push({
      claim: `${field} matches authoritative source`,
      field,
      authoritative_vertical: resolveAuthoritativeVertical(field),
      source_id: receipt.verification.multi_source[0]?.source_id ?? receipt.action.transaction_id,
      observed_at: receipt.verification.multi_source[0]?.observed_at ?? receipt.timestamp,
      query_fingerprint: receipt.verification.multi_source[0]?.query_fingerprint ?? 'inline',
      observed_state_hash: sha256Canonical(actual),
      expected: exp,
      actual: act,
      match: exp === act || String(exp) === String(act),
    });
  }

  for (const diff of receipt.verification.claim_diffs) {
    claims.push({
      claim: `diff:${diff.field}`,
      field: diff.field,
      authoritative_vertical: diff.authoritative_vertical,
      source_id: receipt.action.transaction_id,
      observed_at: receipt.timestamp,
      query_fingerprint: 'assurance-diff',
      observed_state_hash: sha256Canonical(actual),
      expected: diff.expected,
      actual: diff.actual,
      match: false,
    });
  }

  return claims;
}

export function assembleTransactionProof(receipt: Uar20Receipt): TransactionProofBundle {
  const verify = verifyUar20Receipt(receipt, receipt.integrity.previous_uar_hash);
  const integrity: ProofIntegrityChecks = {
    signature_valid: verify.signature_valid,
    chain_valid: verify.chain_valid,
    authority_valid: verify.authority_valid,
    hash_chain_valid: receipt.integrity.hash_chain_valid && verify.chain_valid,
  };

  return {
    transaction_id: receipt.action.transaction_id,
    verification_status: receipt.verification.status,
    false_success_detected: receipt.verification.false_success_detected,
    claims: buildClaims(receipt),
    integrity,
    uar20: receipt,
    exported_at: new Date().toISOString(),
  };
}

export function exportSignedProofBundle(bundle: TransactionProofBundle): {
  proof: TransactionProofBundle;
  proof_json: string;
  manifest: import('@/lib/nexus-core/proof/types').ProofManifest;
} {
  const proof_json = JSON.stringify(bundle.uar20, null, 2);
  return {
    proof: bundle,
    proof_json,
    manifest: {
      manifest_version: '1.0',
      transaction_id: bundle.transaction_id,
      proof_file: 'proof.json',
      public_key_id: bundle.uar20.signatures.public_key_id,
      exported_at: bundle.exported_at,
      schema: bundle.uar20.$schema,
    },
  };
}
