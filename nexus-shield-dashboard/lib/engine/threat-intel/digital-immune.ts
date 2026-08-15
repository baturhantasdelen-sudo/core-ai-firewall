import { createHash } from 'node:crypto';
import { registerThreatSignature } from '@/lib/engine/immune/registry';

export interface TrajectoryPattern {
  sequence: string[];
  label?: string;
  riskLevel?: 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ZkThreatSignature {
  id: string;
  signatureHash: string;
  anonymizedPattern: string[];
  category: 'TRAJECTORY_CHAIN' | 'DATA_EXFILTRATION' | 'PRIVILEGE_ESCALATION';
  severity: 'HIGH' | 'CRITICAL';
  createdAt: string;
  sourceTenantHash: string;
  zeroKnowledge: true;
}

export interface ImmuneSyncResult {
  signatureId: string;
  synced: boolean;
  networkReach: number;
  message: string;
  propagatedAt: string;
}

const immuneNetworkStore: ZkThreatSignature[] = [];
const syncLogStore: ImmuneSyncResult[] = [];

let signatureCounter = 1000;

function hashPattern(sequence: string[]): string {
  const normalized = sequence.map((step) =>
    step.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
  );
  return createHash('sha256').update(normalized.join('→')).digest('hex').slice(0, 16);
}

function anonymizeStep(step: string): string {
  const normalized = step.toLowerCase();
  if (/read_db|db_read|sql/.test(normalized)) return 'step:db_read';
  if (/call_api|api_call|http/.test(normalized)) return 'step:api_call';
  if (/write_file|write_db|save/.test(normalized)) return 'step:write';
  if (/export|bulk_export|dump/.test(normalized)) return 'step:export';
  if (/payment|stripe|financial/.test(normalized)) return 'step:financial';
  if (/exec|shell|run/.test(normalized)) return 'step:execute';
  return `step:${normalized.replace(/[^a-z0-9]/g, '_').slice(0, 12)}`;
}

function classifyCategory(pattern: TrajectoryPattern): ZkThreatSignature['category'] {
  const joined = pattern.sequence.join(' ');
  if (/export|exfil|upload|write_file/.test(joined)) return 'DATA_EXFILTRATION';
  if (/exec|shell|admin|sudo/.test(joined)) return 'PRIVILEGE_ESCALATION';
  return 'TRAJECTORY_CHAIN';
}

function resolveSeverity(pattern: TrajectoryPattern): ZkThreatSignature['severity'] {
  if (pattern.riskLevel === 'CRITICAL') return 'CRITICAL';
  if (pattern.riskLevel === 'HIGH') return 'HIGH';
  const joined = pattern.sequence.join(' ');
  if (/read_db.*call_api.*write|export|exfil/.test(joined)) return 'CRITICAL';
  return 'HIGH';
}

export function generateZkThreatSignature(trajectoryPattern: TrajectoryPattern): ZkThreatSignature {
  signatureCounter += 1;
  const id = `#TS-${signatureCounter.toString(16).toUpperCase().padStart(4, '0')}`;
  const anonymizedPattern = trajectoryPattern.sequence.map(anonymizeStep);
  const signatureHash = hashPattern(anonymizedPattern);
  const sourceTenantHash = createHash('sha256')
    .update(`tenant_${Date.now()}_${Math.random()}`)
    .digest('hex')
    .slice(0, 12);

  return {
    id,
    signatureHash,
    anonymizedPattern,
    category: classifyCategory(trajectoryPattern),
    severity: resolveSeverity(trajectoryPattern),
    createdAt: new Date().toISOString(),
    sourceTenantHash,
    zeroKnowledge: true,
  };
}

export function syncImmuneNetwork(signature: ZkThreatSignature): ImmuneSyncResult {
  const existing = immuneNetworkStore.find((entry) => entry.signatureHash === signature.signatureHash);
  if (existing) {
    const result: ImmuneSyncResult = {
      signatureId: existing.id,
      synced: true,
      networkReach: immuneNetworkStore.length,
      message: 'Signature already propagated — immune memory updated',
      propagatedAt: new Date().toISOString(),
    };
    syncLogStore.unshift(result);
    return result;
  }

  immuneNetworkStore.unshift(signature);

  registerThreatSignature({
    id: signature.id.replace('#', ''),
    signatureHash: signature.signatureHash,
    category:
      signature.category === 'DATA_EXFILTRATION'
        ? 'DATA_EXFILTRATION'
        : signature.category === 'PRIVILEGE_ESCALATION'
          ? 'PRIVILEGE_ESCALATION'
          : 'TOOL_MISUSE',
    pattern: signature.anonymizedPattern,
    severity: signature.severity,
    createdAt: signature.createdAt,
  });

  const networkReach = immuneNetworkStore.length;
  const result: ImmuneSyncResult = {
    signatureId: signature.id,
    synced: true,
    networkReach,
    message: `One Customer Learns → Every Customer Benefits: ${signature.id} propagated to ${networkReach} immune nodes`,
    propagatedAt: new Date().toISOString(),
  };

  syncLogStore.unshift(result);
  if (syncLogStore.length > 50) syncLogStore.pop();

  return result;
}

export function listImmuneNetworkSignatures(limit = 20): ZkThreatSignature[] {
  return immuneNetworkStore.slice(0, limit);
}

export function listImmuneSyncLog(limit = 10): ImmuneSyncResult[] {
  return syncLogStore.slice(0, limit);
}

export function getDigitalImmuneNetworkStats(): {
  totalSignatures: number;
  criticalCount: number;
  lastSyncedAt?: string;
} {
  return {
    totalSignatures: immuneNetworkStore.length,
    criticalCount: immuneNetworkStore.filter((s) => s.severity === 'CRITICAL').length,
    lastSyncedAt: syncLogStore[0]?.propagatedAt,
  };
}

export function resetDigitalImmuneStore(): void {
  immuneNetworkStore.length = 0;
  syncLogStore.length = 0;
  signatureCounter = 1000;
}
