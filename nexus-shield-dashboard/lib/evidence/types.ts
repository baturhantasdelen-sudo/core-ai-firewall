/**
 * P1 Sprint 7-8 — Cryptographic Evidence Engine types.
 */

export type EvidenceStatus = 'VERIFIED' | 'UNVERIFIED' | 'TAMPERED';

export interface EvidenceBundle {
  bundleId: string;
  agentId: string;
  timestamp: string;
  actionType: string;
  requestHash: string;
  responseHash: string;
  dbTxId?: string;
  trajectoryHash?: string;
  cryptographicSignature: string;
  status: EvidenceStatus;
  merkleLeafHash?: string;
}

export interface EvidenceBundleInput {
  agentId: string;
  actionType: string;
  requestPayload: Record<string, unknown> | string;
  responsePayload: Record<string, unknown> | string;
  dbTxId?: string;
  trajectoryHash?: string;
  /** When false, bundle is marked UNVERIFIED (missing critical fields) */
  requireDbTx?: boolean;
}

export interface MerkleProofStep {
  hash: string;
  position: 'left' | 'right';
}

export interface MerkleProof {
  leafHash: string;
  rootHash: string;
  steps: MerkleProofStep[];
  bundleId: string;
}

export interface EvidenceMerkleTree {
  rootHash: string;
  leafCount: number;
  leaves: string[];
  layers: string[][];
  builtAt: string;
}

export interface EvidenceVerificationResult {
  valid: boolean;
  status: EvidenceStatus;
  bundleId: string;
  rootHash: string;
  signatureValid: boolean;
  merkleValid: boolean;
  reason: string;
}

export function isVerifiedBundle(bundle: EvidenceBundle): boolean {
  return bundle.status === 'VERIFIED';
}

export function isUnverifiedBundle(bundle: EvidenceBundle): boolean {
  return bundle.status === 'UNVERIFIED';
}
