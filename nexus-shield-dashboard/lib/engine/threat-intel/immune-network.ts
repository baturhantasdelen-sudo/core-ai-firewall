import {
  checkImmuneNetworkSignatures,
  generateThreatSignature,
  getImmuneNetworkStats,
  listThreatSignatures,
  registerThreatSignature,
  resetThreatRegistry,
} from '@/lib/engine/immune';
import type {
  BehavioralThreatSignature,
  ThreatCategory,
  ThreatSeverity,
  ThreatSignatureInput,
} from '@/lib/engine/immune';
import { inferIntentTags } from '@/lib/engine/action-firewall/intent-engine';

export const SAFE_STANDARD = 'SAFE' as const;
export type SafeStandard = typeof SAFE_STANDARD;

export interface SafeImmuneSyncResult {
  standard: SafeStandard;
  synced: number;
  totalSignatures: number;
  status: 'ACTIVE & PROTECTED';
  anonymized: true;
}

export interface SafeBehavioralSignatureInput extends ThreatSignatureInput {
  agentFaultClass?: string;
}

function anonymizePattern(pattern: string[]): string[] {
  return pattern.map((token) => {
    if (token.startsWith('intent:')) return token;
    if (token.startsWith('tool:')) return token;
    if (token.startsWith('missing_cap:')) return token;
    return `safe:${token.replace(/[^a-z0-9_]/gi, '_').slice(0, 32)}`;
  });
}

export function produceSafeBehavioralSignature(
  input: SafeBehavioralSignatureInput,
): BehavioralThreatSignature | null {
  const signature = generateThreatSignature(input);
  if (!signature) return null;

  return {
    ...signature,
    pattern: anonymizePattern(signature.pattern),
    signatureHash: `safe-${signature.signatureHash}`,
  };
}

export function registerSafeThreatSignature(
  input: SafeBehavioralSignatureInput,
): BehavioralThreatSignature | null {
  const signature = produceSafeBehavioralSignature(input);
  if (!signature) return null;
  return registerThreatSignature(signature);
}

export function syncSafeImmuneNetwork(): SafeImmuneSyncResult {
  const stats = getImmuneNetworkStats();
  const signatures = listThreatSignatures();

  return {
    standard: SAFE_STANDARD,
    synced: signatures.length,
    totalSignatures: stats.totalSignatures,
    status: stats.status,
    anonymized: true,
  };
}

export function checkSafeImmuneNetwork(params: {
  userIntent: string;
  toolName: string;
  violatedCapabilities: string[];
}) {
  return checkImmuneNetworkSignatures({
    ...params,
    userIntent: params.userIntent,
  });
}

export function buildSafeSignatureFromIncident(params: {
  toolSequence: string[];
  userIntent: string;
  violatedCapabilities: string[];
  riskScore: number;
  category?: ThreatCategory;
  severity?: ThreatSeverity;
}): BehavioralThreatSignature | null {
  return produceSafeBehavioralSignature({
    toolSequence: params.toolSequence,
    intentAnomalyTags: inferIntentTags(params.userIntent),
    violatedCapabilities: params.violatedCapabilities,
    riskScore: params.riskScore,
    killSwitchTriggered: params.riskScore > 85,
  });
}

export {
  checkImmuneNetworkSignatures,
  generateThreatSignature,
  getImmuneNetworkStats,
  listThreatSignatures,
  registerThreatSignature,
  resetThreatRegistry,
};

export type {
  BehavioralThreatSignature,
  ThreatCategory,
  ThreatSeverity,
  ThreatSignatureInput,
};
