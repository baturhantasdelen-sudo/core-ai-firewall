import { createHash, createHmac } from 'node:crypto';
import type {
  EvidenceBundle,
  EvidenceBundleInput,
  EvidenceStatus,
} from '@/lib/evidence/types';

const SIGNING_SECRET = process.env.NEXUS_EVIDENCE_SIGNING_SECRET ?? 'nexus-shield-evidence-p1-dev-key';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonicalize(value: Record<string, unknown> | string): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, Object.keys(value).sort());
}

function deriveBundleId(agentId: string, timestamp: string, actionType: string): string {
  return `evb_${sha256(`${agentId}:${timestamp}:${actionType}`).slice(0, 16)}`;
}

function signPayload(payload: string): string {
  return createHmac('sha256', SIGNING_SECRET).update(payload, 'utf8').digest('hex');
}

function resolveStatus(input: EvidenceBundleInput, requestHash: string, responseHash: string): EvidenceStatus {
  if (!requestHash || !responseHash) return 'UNVERIFIED';
  if (input.requireDbTx && !input.dbTxId) return 'UNVERIFIED';
  if (/financial|payment|export|db_write/i.test(input.actionType) && !input.dbTxId) {
    return 'UNVERIFIED';
  }
  return 'VERIFIED';
}

/**
 * Collects action artifacts and produces a SHA-256 signed EvidenceBundle.
 */
export function generateEvidenceBundle(input: EvidenceBundleInput): EvidenceBundle {
  const timestamp = new Date().toISOString();
  const requestHash = sha256(canonicalize(input.requestPayload));
  const responseHash = sha256(canonicalize(input.responsePayload));
  const trajectoryHash = input.trajectoryHash ?? sha256(`${input.agentId}:${input.actionType}:${timestamp}`);
  const bundleId = deriveBundleId(input.agentId, timestamp, input.actionType);

  const status = resolveStatus(input, requestHash, responseHash);

  const signingPayload = [
    bundleId,
    input.agentId,
    timestamp,
    input.actionType,
    requestHash,
    responseHash,
    input.dbTxId ?? '',
    trajectoryHash,
    status,
  ].join('|');

  const cryptographicSignature = signPayload(signingPayload);
  const merkleLeafHash = sha256(`${cryptographicSignature}:${requestHash}:${responseHash}`);

  return {
    bundleId,
    agentId: input.agentId,
    timestamp,
    actionType: input.actionType,
    requestHash,
    responseHash,
    dbTxId: input.dbTxId,
    trajectoryHash,
    cryptographicSignature,
    status,
    merkleLeafHash,
  };
}

export function verifyBundleSignature(bundle: EvidenceBundle): boolean {
  const signingPayload = [
    bundle.bundleId,
    bundle.agentId,
    bundle.timestamp,
    bundle.actionType,
    bundle.requestHash,
    bundle.responseHash,
    bundle.dbTxId ?? '',
    bundle.trajectoryHash ?? '',
    bundle.status === 'TAMPERED' ? 'VERIFIED' : bundle.status,
  ].join('|');

  const expected = signPayload(signingPayload);
  return expected === bundle.cryptographicSignature;
}

export function markBundleTampered(bundle: EvidenceBundle): EvidenceBundle {
  return {
    ...bundle,
    status: 'TAMPERED',
    responseHash: `${bundle.responseHash}_altered`,
  };
}

export function hashBundleLeaf(bundle: EvidenceBundle): string {
  return bundle.merkleLeafHash ?? sha256(`${bundle.cryptographicSignature}:${bundle.requestHash}:${bundle.responseHash}`);
}

export { sha256 };
