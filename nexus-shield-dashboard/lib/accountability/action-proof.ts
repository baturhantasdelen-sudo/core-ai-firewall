import { createHash } from 'node:crypto';

/** UAR v2 action proof factors: Intent + Policy + Tool + Transaction + Result → Action Proof */
export interface ActionProofInputs {
  intent: string;
  policyDocument: unknown;
  toolCall: { name: string; args: Record<string, unknown> };
  transactionId: string;
  result: unknown;
}

export interface ActionProofBundle {
  intentHash: string;
  policyHash: string;
  toolCallHash: string;
  transactionId: string;
  resultHash: string;
  actionProofHash: string;
}

const SHA256_PREFIX = 'sha256:';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

export function sha256Digest(value: unknown): string {
  const payload =
    typeof value === 'string' ? value : canonicalJson(typeof value === 'object' && value !== null ? sortKeysDeep(value) : value);
  const hex = createHash('sha256').update(payload, 'utf8').digest('hex');
  return `${SHA256_PREFIX}${hex}`;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep(record[key]);
        return acc;
      }, {});
  }
  return value;
}

export function computeActionProofBundle(inputs: ActionProofInputs): ActionProofBundle {
  const intentHash = sha256Digest({ intent: inputs.intent.trim() });
  const policyHash = sha256Digest(inputs.policyDocument ?? {});
  const toolCallHash = sha256Digest(inputs.toolCall);
  const transactionId = inputs.transactionId.trim() || 'txn_unspecified';
  const resultHash = sha256Digest(inputs.result ?? {});

  const actionProofHash = sha256Digest({
    intentHash,
    policyHash,
    toolCallHash,
    transactionId,
    resultHash,
  });

  return {
    intentHash,
    policyHash,
    toolCallHash,
    transactionId,
    resultHash,
    actionProofHash,
  };
}

const SIG_PREFIX = 'sig_nexus_ed25519_';

export function validateUarCryptographicSurface(receipt: {
  receipt_id?: string;
  cryptographic_proof?: { evidence_hash?: string; signature?: string };
  outcome_verification?: {
    state_before_hash?: string;
    state_after_hash?: string;
    verifier_signature?: string;
  };
  action_proof?: Partial<ActionProofBundle>;
}): boolean {
  const proof = receipt.cryptographic_proof;
  const outcome = receipt.outcome_verification;
  if (!proof?.evidence_hash?.startsWith(SHA256_PREFIX)) return false;
  if (!proof.signature?.startsWith(SIG_PREFIX)) return false;
  if (outcome?.state_before_hash && !outcome.state_before_hash.startsWith(SHA256_PREFIX)) return false;
  if (outcome?.state_after_hash && !outcome.state_after_hash.startsWith(SHA256_PREFIX)) return false;
  if (outcome?.verifier_signature && !outcome.verifier_signature.startsWith(SIG_PREFIX)) return false;
  if (receipt.receipt_id && !receipt.receipt_id.startsWith('aar_')) return false;
  if (receipt.action_proof?.actionProofHash && !receipt.action_proof.actionProofHash.startsWith(SHA256_PREFIX)) {
    return false;
  }
  return true;
}
