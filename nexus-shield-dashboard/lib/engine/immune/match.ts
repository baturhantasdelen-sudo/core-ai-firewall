import { listThreatSignatures } from './registry';
import { buildPatternFromAction, inferIntentTags } from './signature';

export interface ImmuneMatchResult {
  matched: boolean;
  signatureId?: string;
  category?: string;
  violation?: string;
  riskBoost: number;
}

function patternOverlap(current: string[], known: string[]): number {
  const currentSet = new Set(current);
  let overlap = 0;
  for (const token of known) {
    if (currentSet.has(token)) overlap += 1;
  }
  return overlap;
}

export function checkImmuneNetworkSignatures(params: {
  userIntent: string;
  toolName: string;
  violatedCapabilities: string[];
  toolSequence?: string[];
}): ImmuneMatchResult {
  const intentTags = inferIntentTags(params.userIntent);
  const currentPattern = buildPatternFromAction({
    userIntent: params.userIntent,
    toolName: params.toolName,
    violatedCapabilities: params.violatedCapabilities,
    intentTags,
  });

  if (params.toolSequence && params.toolSequence.length > 1) {
    for (const tool of params.toolSequence) {
      currentPattern.push(...buildPatternFromAction({
        userIntent: params.userIntent,
        toolName: tool,
        violatedCapabilities: params.violatedCapabilities,
        intentTags,
      }));
    }
  }

  const uniquePattern = [...new Set(currentPattern)];
  const signatures = listThreatSignatures();

  for (const signature of signatures) {
    const overlap = patternOverlap(uniquePattern, signature.pattern);
    const threshold = Math.max(2, Math.min(3, signature.pattern.length - 1));

    if (overlap >= threshold) {
      return {
        matched: true,
        signatureId: signature.id,
        category: signature.category,
        violation: `MATCHED_GLOBAL_THREAT_SIGNATURE (#${signature.id})`,
        riskBoost: 40,
      };
    }
  }

  return { matched: false, riskBoost: 0 };
}
