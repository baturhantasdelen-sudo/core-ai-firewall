export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'INSUFFICIENT_EVIDENCE';

export type ProofComponent =
  | 'TRANSACTION_ID'
  | 'BANK_API_RESPONSE'
  | 'DATABASE_RECORD_HASH'
  | 'EXECUTION_LOG'
  | 'AUTHORIZED_AGENT_SIGNATURE';

export interface ActionOutcomePayload {
  toolName: string;
  actionType?: string;
  agentId?: string;
  args?: Record<string, unknown>;
}

export interface EvidenceBundle {
  transactionId?: string;
  bankApiResponse?: string;
  databaseRecordHash?: string;
  executionLog?: string;
  authorizedAgentSignature?: string;
}

export interface OutcomeVerificationResult {
  verificationStatus: VerificationStatus;
  confidenceScore: number;
  missingProofs: ProofComponent[];
  satisfiedProofs: ProofComponent[];
  violations: string[];
}

const PROOF_FIELD_MAP: Record<ProofComponent, keyof EvidenceBundle> = {
  TRANSACTION_ID: 'transactionId',
  BANK_API_RESPONSE: 'bankApiResponse',
  DATABASE_RECORD_HASH: 'databaseRecordHash',
  EXECUTION_LOG: 'executionLog',
  AUTHORIZED_AGENT_SIGNATURE: 'authorizedAgentSignature',
};

const PROOF_VALIDATORS: Record<ProofComponent, (value: string) => boolean> = {
  TRANSACTION_ID: (value) => /^(?:TXN|ERP|TRX)[-_A-Z0-9]{4,64}$/i.test(value.trim()),
  BANK_API_RESPONSE: (value) =>
    value.trim().length >= 16 &&
    (/"status"\s*:\s*"(?:ok|success|completed)"/i.test(value) ||
      /bank_api_response|payment_confirmed|stripe_pi_/i.test(value)),
  DATABASE_RECORD_HASH: (value) =>
    /^(?:sha256:|sha512:|0x)?[a-f0-9]{16,128}$/i.test(value.trim()),
  EXECUTION_LOG: (value) =>
    value.trim().length >= 12 &&
    (/\[\d{4}-\d{2}-\d{2}/.test(value) || /exec_id|run_id|trace_id/i.test(value)),
  AUTHORIZED_AGENT_SIGNATURE: (value) =>
    /^sig_[A-Za-z0-9+/=_-]{16,}$/.test(value.trim()) ||
    /^[A-Za-z0-9+/=]{32,}\.[A-Za-z0-9+/=]{16,}$/.test(value.trim()),
};

const ACTION_PROOF_REQUIREMENTS: Record<string, ProofComponent[]> = {
  FINANCIAL: ['TRANSACTION_ID', 'BANK_API_RESPONSE', 'AUTHORIZED_AGENT_SIGNATURE'],
  PAYMENT: ['TRANSACTION_ID', 'BANK_API_RESPONSE', 'AUTHORIZED_AGENT_SIGNATURE'],
  EXPORT: ['DATABASE_RECORD_HASH', 'EXECUTION_LOG', 'AUTHORIZED_AGENT_SIGNATURE'],
  DB_WRITE: ['DATABASE_RECORD_HASH', 'EXECUTION_LOG'],
  EXECUTE: ['EXECUTION_LOG', 'AUTHORIZED_AGENT_SIGNATURE'],
  GENERAL: [],
};

function inferActionCategory(toolName: string, actionType?: string): string {
  if (actionType) return actionType.toUpperCase();
  const normalized = toolName.toLowerCase();
  if (/stripe|payment|transfer|billing|financial|refund/.test(normalized)) return 'FINANCIAL';
  if (/bulk_export|export_db|export_customer|dump|sql_export/.test(normalized)) return 'EXPORT';
  if (/insert|update|delete|write_db|modify_db/.test(normalized)) return 'DB_WRITE';
  if (/exec|shell|run_command|subprocess/.test(normalized)) return 'EXECUTE';
  return 'GENERAL';
}

function resolveProofValue(component: ProofComponent, bundle?: EvidenceBundle): string | undefined {
  if (!bundle) return undefined;
  const field = PROOF_FIELD_MAP[component];
  const value = bundle[field];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isProofValid(component: ProofComponent, bundle?: EvidenceBundle): boolean {
  const value = resolveProofValue(component, bundle);
  if (!value) return false;
  return PROOF_VALIDATORS[component](value);
}

function computeConfidenceScore(
  required: ProofComponent[],
  satisfied: ProofComponent[],
  bundle?: EvidenceBundle,
): number {
  if (required.length === 0) return 100;

  const validCount = required.filter((proof) => isProofValid(proof, bundle)).length;
  const base = Math.round((validCount / required.length) * 80);

  const supplemental = (Object.keys(PROOF_FIELD_MAP) as ProofComponent[])
    .filter((proof) => !required.includes(proof) && isProofValid(proof, bundle))
    .length;

  return Math.min(100, base + supplemental * 5);
}

export function verifyActionOutcome(
  actionPayload: ActionOutcomePayload,
  evidenceBundle?: EvidenceBundle,
): OutcomeVerificationResult {
  const category = inferActionCategory(actionPayload.toolName, actionPayload.actionType);
  const requiredProofs = ACTION_PROOF_REQUIREMENTS[category] ?? ACTION_PROOF_REQUIREMENTS.GENERAL!;
  const missingProofs: ProofComponent[] = [];
  const satisfiedProofs: ProofComponent[] = [];
  const violations: string[] = [];

  if (requiredProofs.length === 0) {
    return {
      verificationStatus: 'VERIFIED',
      confidenceScore: 100,
      missingProofs: [],
      satisfiedProofs: [],
      violations: [],
    };
  }

  if (!evidenceBundle) {
    return {
      verificationStatus: 'UNVERIFIED',
      confidenceScore: 0,
      missingProofs: [...requiredProofs],
      satisfiedProofs: [],
      violations: [
        `UNVERIFIED: ${actionPayload.toolName} has no evidence bundle attached`,
      ],
    };
  }

  for (const proof of requiredProofs) {
    const raw = resolveProofValue(proof, evidenceBundle);
    if (!raw) {
      missingProofs.push(proof);
      continue;
    }
    if (isProofValid(proof, evidenceBundle)) {
      satisfiedProofs.push(proof);
    } else {
      missingProofs.push(proof);
      violations.push(`${proof} present but failed format/cryptographic validation`);
    }
  }

  const confidenceScore = computeConfidenceScore(requiredProofs, satisfiedProofs, evidenceBundle);

  if (missingProofs.length === requiredProofs.length) {
    return {
      verificationStatus: 'UNVERIFIED',
      confidenceScore,
      missingProofs,
      satisfiedProofs,
      violations: [
        ...violations,
        `UNVERIFIED: all required proofs missing for ${category} action`,
      ],
    };
  }

  if (missingProofs.length > 0) {
    return {
      verificationStatus: 'INSUFFICIENT_EVIDENCE',
      confidenceScore,
      missingProofs,
      satisfiedProofs,
      violations: [
        ...violations,
        `INSUFFICIENT_EVIDENCE: missing ${missingProofs.join(', ')}`,
      ],
    };
  }

  if (confidenceScore < 65) {
    return {
      verificationStatus: 'INSUFFICIENT_EVIDENCE',
      confidenceScore,
      missingProofs,
      satisfiedProofs,
      violations: [
        ...violations,
        'INSUFFICIENT_EVIDENCE: confidence score below verification threshold (65)',
      ],
    };
  }

  return {
    verificationStatus: 'VERIFIED',
    confidenceScore,
    missingProofs: [],
    satisfiedProofs,
    violations: [],
  };
}

const outcomeLogStore: Array<{
  id: string;
  agentId?: string;
  toolName: string;
  result: OutcomeVerificationResult;
  timestamp: string;
}> = [];

export function recordOutcomeVerification(
  actionPayload: ActionOutcomePayload,
  result: OutcomeVerificationResult,
): void {
  outcomeLogStore.unshift({
    id: `outcome-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    agentId: actionPayload.agentId,
    toolName: actionPayload.toolName,
    result,
    timestamp: new Date().toISOString(),
  });
  if (outcomeLogStore.length > 100) outcomeLogStore.pop();
}

export function listOutcomeVerificationLogs(agentId?: string) {
  if (agentId) return outcomeLogStore.filter((entry) => entry.agentId === agentId);
  return [...outcomeLogStore];
}

export function resetEvidentialVerifierStore(): void {
  outcomeLogStore.length = 0;
}
