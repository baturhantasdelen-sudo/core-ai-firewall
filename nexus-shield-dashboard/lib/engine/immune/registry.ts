import type { BehavioralThreatSignature } from './signature';

const threatRegistry = new Map<string, BehavioralThreatSignature>();

const SEED_SIGNATURES: BehavioralThreatSignature[] = [
  {
    id: 'TS-A1B2C3D4',
    signatureHash: 'seed-invoice-export-privilege',
    category: 'DATA_EXFILTRATION',
    pattern: ['intent:invoice', 'intent:read', 'missing_cap:DB_QUERY', 'tool:bulk_export'],
    severity: 'CRITICAL',
    createdAt: '2026-08-14T17:00:00.000Z',
  },
  {
    id: 'TS-E5F6G7H8',
    signatureHash: 'seed-financial-privilege',
    category: 'PRIVILEGE_ESCALATION',
    pattern: ['intent:read', 'missing_cap:FINANCIAL', 'tool:financial_mutation'],
    severity: 'HIGH',
    createdAt: '2026-08-14T17:05:00.000Z',
  },
];

let seeded = false;
let seedingDisabled = false;

function ensureSeeded(): void {
  if (seeded) return;
  if (seedingDisabled) {
    seeded = true;
    return;
  }
  for (const signature of SEED_SIGNATURES) {
    threatRegistry.set(signature.id, signature);
  }
  seeded = true;
}

export function registerThreatSignature(signature: BehavioralThreatSignature): BehavioralThreatSignature {
  ensureSeeded();
  threatRegistry.set(signature.id, signature);
  return signature;
}

export function listThreatSignatures(): BehavioralThreatSignature[] {
  ensureSeeded();
  return [...threatRegistry.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getThreatSignature(id: string): BehavioralThreatSignature | undefined {
  ensureSeeded();
  return threatRegistry.get(id);
}

export function resetThreatRegistry(options?: { skipSeed?: boolean }): void {
  threatRegistry.clear();
  seeded = false;
  seedingDisabled = options?.skipSeed ?? false;
}

export function getImmuneNetworkStats() {
  ensureSeeded();
  const signatures = listThreatSignatures();
  return {
    status: 'ACTIVE & PROTECTED' as const,
    totalSignatures: signatures.length,
    criticalSignatures: signatures.filter((signature) => signature.severity === 'CRITICAL').length,
    categories: {
      GOAL_HIJACK: signatures.filter((signature) => signature.category === 'GOAL_HIJACK').length,
      PRIVILEGE_ESCALATION: signatures.filter((signature) => signature.category === 'PRIVILEGE_ESCALATION').length,
      TOOL_MISUSE: signatures.filter((signature) => signature.category === 'TOOL_MISUSE').length,
      DATA_EXFILTRATION: signatures.filter((signature) => signature.category === 'DATA_EXFILTRATION').length,
    },
  };
}
