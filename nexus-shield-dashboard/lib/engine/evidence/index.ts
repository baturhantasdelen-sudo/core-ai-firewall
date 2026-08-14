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
}

const CRITICAL_ACTION_REQUIREMENTS: Record<CriticalActionType, Array<keyof ActionEvidence>> = {
  FINANCIAL_MUTATION: ['erpTransactionId'],
  DB_MODIFICATION: ['dbModificationHash'],
  BULK_EXPORT: ['apiLogDiff', 'dbModificationHash'],
  PRIVILEGED_EXECUTION: ['apiLogDiff'],
  GENERAL: [],
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
  return typeof value === 'string' && value.trim().length >= 4;
}

export function verifyActionEvidence(
  input: EvidenceVerificationInput,
): EvidenceVerificationResult {
  const actionType = input.actionType === 'GENERAL' ? inferActionType(input.toolName) : input.actionType;
  const requiredFields = CRITICAL_ACTION_REQUIREMENTS[actionType];
  const missingEvidence: string[] = [];
  const violations: string[] = [];

  if (requiredFields.length === 0) {
    return {
      verified: true,
      status: 'VERIFIED',
      missingEvidence,
      violations,
    };
  }

  const satisfied = requiredFields.filter((field) => hasValidEvidence(field, input.evidence));

  if (actionType === 'BULK_EXPORT') {
    if (satisfied.length === 0) {
      missingEvidence.push('apiLogDiff or dbModificationHash');
      violations.push('UNVERIFIED_ACTION: bulk export missing audit trail evidence');
    }
  } else {
    for (const field of requiredFields) {
      if (!hasValidEvidence(field, input.evidence)) {
        missingEvidence.push(field);
      }
    }
    if (missingEvidence.length > 0) {
      violations.push(
        `UNVERIFIED_ACTION: ${actionType.toLowerCase().replace(/_/g, ' ')} missing ${missingEvidence.join(', ')}`,
      );
    }
  }

  const verified = violations.length === 0;

  return {
    verified,
    status: verified ? 'VERIFIED' : 'UNVERIFIED_ACTION',
    missingEvidence,
    violations,
  };
}
