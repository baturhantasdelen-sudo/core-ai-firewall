export type EvidenceStatus = 'VERIFIED' | 'UNVERIFIED_ACTION';

export type CriticalActionType =
  | 'FINANCIAL_MUTATION'
  | 'DB_MODIFICATION'
  | 'BULK_EXPORT'
  | 'PRIVILEGED_EXECUTION'
  | 'GENERAL';

export interface ActionEvidence {
  erpTransactionId?: string;
  apiLogDiff?: string;
  dbModificationHash?: string;
}

export interface EvidenceVerificationInput {
  actionType: CriticalActionType;
  toolName: string;
  evidence?: ActionEvidence;
}

export interface EvidenceVerificationResult {
  verified: boolean;
  status: EvidenceStatus;
  missingEvidence: string[];
  violations: string[];
  evidenceChainStrength: number;
  actionType: CriticalActionType;
}

const CRITICAL_ACTION_REQUIREMENTS: Record<CriticalActionType, Array<keyof ActionEvidence>> = {
  FINANCIAL_MUTATION: ['erpTransactionId'],
  DB_MODIFICATION: ['dbModificationHash'],
  BULK_EXPORT: ['apiLogDiff', 'dbModificationHash'],
  PRIVILEGED_EXECUTION: ['apiLogDiff'],
  GENERAL: [],
};

const EVIDENCE_VALIDATORS: Record<keyof ActionEvidence, (value: string) => boolean> = {
  erpTransactionId: (value) => /^(?:ERP[-_:]?)?[A-Z0-9-]{4,64}$/i.test(value.trim()),
  apiLogDiff: (value) => value.trim().length >= 8 && /(?:diff|delta|patch|log|audit)/i.test(value),
  dbModificationHash: (value) => /^(?:sha256:|sha512:|0x)?[a-f0-9]{8,128}$/i.test(value.trim()),
};

function inferActionType(toolName: string): CriticalActionType {
  const normalized = toolName.toLowerCase();
  if (/stripe|payment|transfer|billing|financial|refund/.test(normalized)) {
    return 'FINANCIAL_MUTATION';
  }
  if (/bulk_export|export_db|dump|sql_export/.test(normalized)) return 'BULK_EXPORT';
  if (/insert|update|delete|write_db|modify_db|sql_mutation/.test(normalized)) {
    return 'DB_MODIFICATION';
  }
  if (/exec|shell|run_command|subprocess|sudo/.test(normalized)) return 'PRIVILEGED_EXECUTION';
  return 'GENERAL';
}

function hasValidEvidence(field: keyof ActionEvidence, evidence?: ActionEvidence): boolean {
  if (!evidence) return false;
  const value = evidence[field];
  if (typeof value !== 'string' || value.trim().length < 4) return false;
  const validator = EVIDENCE_VALIDATORS[field];
  return validator ? validator(value) : value.trim().length >= 4;
}

function computeEvidenceChainStrength(
  actionType: CriticalActionType,
  evidence: ActionEvidence | undefined,
  requiredFields: Array<keyof ActionEvidence>,
): number {
  if (requiredFields.length === 0) return 100;
  if (!evidence) return 0;

  const presentFields = (Object.keys(evidence) as Array<keyof ActionEvidence>).filter((field) =>
    hasValidEvidence(field, evidence),
  );

  if (actionType === 'BULK_EXPORT') {
    const hasLog = hasValidEvidence('apiLogDiff', evidence);
    const hasHash = hasValidEvidence('dbModificationHash', evidence);
    if (hasLog && hasHash) return 100;
    if (hasLog || hasHash) return 65;
    return 0;
  }

  if (actionType === 'FINANCIAL_MUTATION' && hasValidEvidence('erpTransactionId', evidence)) {
    const bonus = hasValidEvidence('apiLogDiff', evidence) ? 15 : 0;
    return Math.min(100, 85 + bonus);
  }

  if (actionType === 'DB_MODIFICATION' && hasValidEvidence('dbModificationHash', evidence)) {
    const bonus = hasValidEvidence('apiLogDiff', evidence) ? 10 : 0;
    return Math.min(100, 80 + bonus);
  }

  const satisfiedRequired = requiredFields.filter((field) => hasValidEvidence(field, evidence)).length;
  const baseScore = Math.round((satisfiedRequired / requiredFields.length) * 70);
  const supplemental = presentFields.filter((field) => !requiredFields.includes(field)).length * 10;
  return Math.min(100, baseScore + supplemental);
}

export function verifyActionEvidence(
  input: EvidenceVerificationInput,
): EvidenceVerificationResult {
  const actionType = input.actionType === 'GENERAL' ? inferActionType(input.toolName) : input.actionType;
  const requiredFields = CRITICAL_ACTION_REQUIREMENTS[actionType];
  const missingEvidence: string[] = [];
  const violations: string[] = [];

  const evidenceChainStrength = computeEvidenceChainStrength(
    actionType,
    input.evidence,
    requiredFields,
  );

  if (requiredFields.length === 0) {
    return {
      verified: true,
      status: 'VERIFIED',
      missingEvidence,
      violations,
      evidenceChainStrength,
      actionType,
    };
  }

  const satisfied = requiredFields.filter((field) => hasValidEvidence(field, input.evidence));

  if (actionType === 'BULK_EXPORT') {
    if (satisfied.length === 0) {
      missingEvidence.push('apiLogDiff or dbModificationHash');
      violations.push('UNVERIFIED_ACTION: bulk export missing audit trail evidence (ERP/log/hash chain)');
    } else if (evidenceChainStrength < 65) {
      violations.push('UNVERIFIED_ACTION: bulk export evidence chain below verification threshold');
    }
  } else {
    for (const field of requiredFields) {
      if (!hasValidEvidence(field, input.evidence)) {
        missingEvidence.push(field);
      }
    }
    if (missingEvidence.length > 0) {
      violations.push(
        `UNVERIFIED_ACTION: ${actionType.toLowerCase().replace(/_/g, ' ')} missing ${missingEvidence.join(', ')} — no verifiable evidence chain`,
      );
    }
  }

  if (input.evidence && missingEvidence.length === 0) {
    for (const field of requiredFields) {
      const raw = input.evidence[field];
      if (typeof raw === 'string' && raw.trim().length >= 4 && !hasValidEvidence(field, input.evidence)) {
        violations.push(`UNVERIFIED_ACTION: ${field} present but failed cryptographic/format validation`);
        missingEvidence.push(`${field} (invalid format)`);
      }
    }
  }

  const verified = violations.length === 0 && evidenceChainStrength >= 65;

  return {
    verified,
    status: verified ? 'VERIFIED' : 'UNVERIFIED_ACTION',
    missingEvidence,
    violations,
    evidenceChainStrength,
    actionType,
  };
}
