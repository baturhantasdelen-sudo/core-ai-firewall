export {
  generateThreatSignature,
  shouldGenerateThreatSignature,
  buildPatternFromAction,
  inferIntentTags,
  createSignatureId,
} from './signature';
export type {
  BehavioralThreatSignature,
  ThreatCategory,
  ThreatSeverity,
  ThreatSignatureInput,
} from './signature';

export {
  registerThreatSignature,
  listThreatSignatures,
  getThreatSignature,
  resetThreatRegistry,
  getImmuneNetworkStats,
} from './registry';

export { checkImmuneNetworkSignatures } from './match';
export type { ImmuneMatchResult } from './match';
