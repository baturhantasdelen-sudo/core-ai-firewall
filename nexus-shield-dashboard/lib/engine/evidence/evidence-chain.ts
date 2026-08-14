export type EvidenceStatus = 'VERIFIED' | 'UNVERIFIED_ACTION';

export type EvidenceType =
  | 'ERP_TRANSACTION_ID'
  | 'DB_MODIFICATION_HASH'
  | 'SIGNED_API_RESPONSE';

export type CriticalActionType =
  | 'FINANCIAL_MUTATION'
  | 'DB_MODIFICATION'
  | 'BULK_EXPORT'
  | 'PRIVILEGED_EXECUTION'
  | 'GENERAL';

export interface ActionPayload {
  toolName: string;
  actionType?: CriticalActionType;
  args?: Record<string, unknown>;
}

export interface EvidenceData {
  erpTransactionId?: string;
  dbModificationHash?: string;
  signedApiResponse?: string;
  apiLogDiff?: string;
}

export interface EvidenceChainResult {
  verified: boolean;
  status: EvidenceStatus;
  missingEvidence: EvidenceType[];
  violations: string[];
  evidenceChainStrength: number;
  actionType: CriticalActionType;
  requiredEvidenceTypes: EvidenceType[];
}

export interface EvidenceChainLogEntry {
  id: string;
  agentId: string;
  toolName: string;
  status: EvidenceStatus;
  evidenceType: EvidenceType | 'NONE';
  evidenceChainStrength: number;
  timestamp: string;
}

const EVIDENCE_FIELD_MAP: Record<EvidenceType, keyof EvidenceData> = {
  ERP_TRANSACTION_ID: 'erpTransactionId',
  DB_MODIFICATION_HASH: 'dbModificationHash',
  SIGNED_API_RESPONSE: 'signedApiResponse',
};

const CRITICAL_ACTION_REQUIREMENTS: Record<CriticalActionType, EvidenceType[]> = {
  FINANCIAL_MUTATION: ['ERP_TRANSACTION_ID'],
  DB_MODIFICATION: ['DB_MODIFICATION_HASH'],
  BULK_EXPORT: ['SIGNED_API_RESPONSE', 'DB_MODIFICATION_HASH'],
  PRIVILEGED_EXECUTION: ['SIGNED_API_RESPONSE'],
  GENERAL: [],
};

const EVIDENCE_VALIDATORS: Record<EvidenceType, (value: string) => boolean> = {
  ERP_TRANSACTION_ID: (value) => /^(?:ERP[-_:]?)?[A-Z0-9-]{4,64}$/i.test(value.trim()),
  DB_MODIFICATION_HASH: (value) => /^(?:sha256:|sha512:|0x)?[a-f0-9]{8,128}$/i.test(value.trim()),
  SIGNED_API_RESPONSE: (value) =>
    value.trim().length >= 8 &&
    (/(?:diff|delta|patch|log|audit|sig|signed|jwt|response)/i.test(value) ||
      /^[A-Za-z0-9+/=_-]{16,}$/.test(value)),
};

const VERIFICATION_THRESHOLD = 65;

const evidenceLogStore: EvidenceChainLogEntry[] = [];

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

function resolveEvidenceValue(
  evidenceType: EvidenceType,
  evidence?: EvidenceData,
): string | undefined {
  if (!evidence) return undefined;
  const field = EVIDENCE_FIELD_MAP[evidenceType];
  const primary = evidence[field];
  if (typeof primary === 'string' && primary.trim().length > 0) return primary;
  if (evidenceType === 'SIGNED_API_RESPONSE' && evidence.apiLogDiff) {
    return evidence.apiLogDiff;
  }
  return undefined;
}

function hasValidEvidence(evidenceType: EvidenceType, evidence?: EvidenceData): boolean {
  const value = resolveEvidenceValue(evidenceType, evidence);
  if (!value || value.trim().length < 4) return false;
  return EVIDENCE_VALIDATORS[evidenceType](value);
}

function computeEvidenceChainStrength(
  actionType: CriticalActionType,
  evidence: EvidenceData | undefined,
  requiredTypes: EvidenceType[],
): number {
  if (requiredTypes.length === 0) return 100;
  if (!evidence) return 0;

  if (actionType === 'BULK_EXPORT') {
    const hasLog = hasValidEvidence('SIGNED_API_RESPONSE', evidence);
    const hasHash = hasValidEvidence('DB_MODIFICATION_HASH', evidence);
    if (hasLog && hasHash) return 100;
    if (hasLog || hasHash) return 65;
    return 0;
  }

  if (actionType === 'FINANCIAL_MUTATION' && hasValidEvidence('ERP_TRANSACTION_ID', evidence)) {
    const bonus = hasValidEvidence('SIGNED_API_RESPONSE', evidence) ? 15 : 0;
    return Math.min(100, 85 + bonus);
  }

  if (actionType === 'DB_MODIFICATION' && hasValidEvidence('DB_MODIFICATION_HASH', evidence)) {
    const bonus = hasValidEvidence('SIGNED_API_RESPONSE', evidence) ? 10 : 0;
    return Math.min(100, 80 + bonus);
  }

  const satisfied = requiredTypes.filter((type) => hasValidEvidence(type, evidence)).length;
  const supplemental = (Object.keys(EVIDENCE_FIELD_MAP) as EvidenceType[])
    .filter((type) => hasValidEvidence(type, evidence) && !requiredTypes.includes(type))
    .length;

  return Math.min(
    100,
    Math.round((satisfied / requiredTypes.length) * 70) + supplemental * 10,
  );
}

export function verifyActionEvidence(
  actionPayload: ActionPayload,
  evidenceData?: EvidenceData,
): EvidenceChainResult {
  const actionType =
    actionPayload.actionType === 'GENERAL' || !actionPayload.actionType
      ? inferActionType(actionPayload.toolName)
      : actionPayload.actionType;

  const requiredEvidenceTypes = CRITICAL_ACTION_REQUIREMENTS[actionType];
  const missingEvidence: EvidenceType[] = [];
  const violations: string[] = [];

  const evidenceChainStrength = computeEvidenceChainStrength(
    actionType,
    evidenceData,
    requiredEvidenceTypes,
  );

  if (requiredEvidenceTypes.length === 0) {
    return {
      verified: true,
      status: 'VERIFIED',
      missingEvidence,
      violations,
      evidenceChainStrength,
      actionType,
      requiredEvidenceTypes,
    };
  }

  const satisfied = requiredEvidenceTypes.filter((type) => hasValidEvidence(type, evidenceData));

  if (actionType === 'BULK_EXPORT') {
    if (satisfied.length === 0) {
      missingEvidence.push('SIGNED_API_RESPONSE', 'DB_MODIFICATION_HASH');
      violations.push(
        'UNVERIFIED_ACTION: bulk export missing audit trail evidence (ERP/log/hash chain)',
      );
    } else if (evidenceChainStrength < VERIFICATION_THRESHOLD) {
      violations.push('UNVERIFIED_ACTION: bulk export evidence chain below verification threshold');
    }
  } else {
    for (const evidenceType of requiredEvidenceTypes) {
      if (!hasValidEvidence(evidenceType, evidenceData)) {
        missingEvidence.push(evidenceType);
      }
    }
    if (missingEvidence.length > 0) {
      violations.push(
        `UNVERIFIED_ACTION: ${actionType.toLowerCase().replace(/_/g, ' ')} missing ${missingEvidence.join(', ')} — no verifiable evidence chain`,
      );
    }
  }

  if (evidenceData && missingEvidence.length === 0) {
    for (const evidenceType of requiredEvidenceTypes) {
      const raw = resolveEvidenceValue(evidenceType, evidenceData);
      if (typeof raw === 'string' && raw.trim().length >= 4 && !hasValidEvidence(evidenceType, evidenceData)) {
        violations.push(
          `UNVERIFIED_ACTION: ${evidenceType} present but failed cryptographic/format validation`,
        );
        missingEvidence.push(evidenceType);
      }
    }
  }

  const verified = violations.length === 0 && evidenceChainStrength >= VERIFICATION_THRESHOLD;

  return {
    verified,
    status: verified ? 'VERIFIED' : 'UNVERIFIED_ACTION',
    missingEvidence,
    violations,
    evidenceChainStrength,
    actionType,
    requiredEvidenceTypes,
  };
}

export function recordEvidenceChainLog(
  agentId: string,
  actionPayload: ActionPayload,
  result: EvidenceChainResult,
): EvidenceChainLogEntry {
  const entry: EvidenceChainLogEntry = {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agentId,
    toolName: actionPayload.toolName,
    status: result.status,
    evidenceType: result.requiredEvidenceTypes[0] ?? 'NONE',
    evidenceChainStrength: result.evidenceChainStrength,
    timestamp: new Date().toISOString(),
  };
  evidenceLogStore.unshift(entry);
  if (evidenceLogStore.length > 100) evidenceLogStore.pop();
  return entry;
}

export function listEvidenceChainLogs(agentId?: string): EvidenceChainLogEntry[] {
  if (agentId) return evidenceLogStore.filter((entry) => entry.agentId === agentId);
  return [...evidenceLogStore];
}

export function getEvidenceVerificationRatio(agentId: string): number {
  const entries = listEvidenceChainLogs(agentId);
  if (entries.length === 0) return 100;
  const verified = entries.filter((entry) => entry.status === 'VERIFIED').length;
  return Math.round((verified / entries.length) * 100);
}

export function resetEvidenceChainStore(): void {
  evidenceLogStore.length = 0;
}
