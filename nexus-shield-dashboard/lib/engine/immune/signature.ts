import { createHash, randomBytes } from 'node:crypto';

export type ThreatCategory =
  | 'GOAL_HIJACK'
  | 'PRIVILEGE_ESCALATION'
  | 'TOOL_MISUSE'
  | 'DATA_EXFILTRATION';

export type ThreatSeverity = 'HIGH' | 'CRITICAL';

export interface BehavioralThreatSignature {
  id: string;
  signatureHash: string;
  category: ThreatCategory;
  pattern: string[];
  severity: ThreatSeverity;
  createdAt: string;
}

export interface ThreatSignatureInput {
  toolSequence: string[];
  intentAnomalyTags: string[];
  violatedCapabilities: string[];
  riskScore: number;
  killSwitchTriggered: boolean;
}

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function abstractToolName(toolName: string): string {
  const normalized = toolName.toLowerCase();
  if (/bulk_export|export_db|sql_export|dump/.test(normalized)) return 'tool:bulk_export';
  if (/stripe|payment|transfer|billing|financial/.test(normalized)) return 'tool:financial_mutation';
  if (/exec|shell|run_command|subprocess/.test(normalized)) return 'tool:execute';
  if (/read|fetch|get/.test(normalized)) return 'tool:read';
  if (/write|upload|save/.test(normalized)) return 'tool:write';
  if (/web_search|search_web/.test(normalized)) return 'tool:web_search';
  return `tool:${normalized.replace(/[^a-z0-9_]/g, '_').slice(0, 32)}`;
}

function abstractIntentTag(tag: string): string {
  return `intent:${tag}`;
}

function classifyThreatCategory(
  intentTags: string[],
  toolSequence: string[],
  violatedCapabilities: string[],
): ThreatCategory {
  const tools = toolSequence.join(' ');
  const hasExport = /tool:bulk_export|export|dump/.test(tools);
  const hasInvoiceIntent = intentTags.includes('invoice') || intentTags.includes('read');
  const hasFinancial = /tool:financial|FINANCIAL/.test(`${tools} ${violatedCapabilities.join(' ')}`);
  const hasExecute = /tool:execute|EXECUTE/.test(`${tools} ${violatedCapabilities.join(' ')}`);

  if (hasExport && hasInvoiceIntent) return 'DATA_EXFILTRATION';
  if (violatedCapabilities.length > 0) return 'PRIVILEGE_ESCALATION';
  if (hasExecute && hasInvoiceIntent) return 'GOAL_HIJACK';
  if (hasFinancial) return 'TOOL_MISUSE';
  return 'TOOL_MISUSE';
}

function buildAbstractPattern(input: ThreatSignatureInput): string[] {
  const pattern = new Set<string>();

  for (const tool of input.toolSequence) {
    pattern.add(abstractToolName(tool));
  }

  for (const tag of input.intentAnomalyTags) {
    pattern.add(abstractIntentTag(tag));
  }

  for (const capability of input.violatedCapabilities) {
    pattern.add(`missing_cap:${capability.toUpperCase()}`);
  }

  if (input.killSwitchTriggered) {
    pattern.add('signal:kill_switch');
  }

  if (input.riskScore > 85) {
    pattern.add('signal:critical_risk');
  }

  return [...pattern].sort();
}

export function shouldGenerateThreatSignature(input: ThreatSignatureInput): boolean {
  return input.riskScore > 75 || input.killSwitchTriggered;
}

export function generateThreatSignature(input: ThreatSignatureInput): BehavioralThreatSignature | null {
  if (!shouldGenerateThreatSignature(input)) {
    return null;
  }

  const pattern = buildAbstractPattern(input);
  const signatureHash = hashValue(pattern.join('|'));
  const category = classifyThreatCategory(
    input.intentAnomalyTags,
    input.toolSequence,
    input.violatedCapabilities,
  );
  const severity: ThreatSeverity =
    input.killSwitchTriggered || input.riskScore > 85 ? 'CRITICAL' : 'HIGH';
  const shortId = signatureHash.slice(0, 8).toUpperCase();

  return {
    id: `TS-${shortId}`,
    signatureHash,
    category,
    pattern,
    severity,
    createdAt: new Date().toISOString(),
  };
}

export function buildPatternFromAction(params: {
  userIntent: string;
  toolName: string;
  violatedCapabilities: string[];
  intentTags?: string[];
}): string[] {
  const intentTags = params.intentTags ?? inferIntentTags(params.userIntent);
  return buildAbstractPattern({
    toolSequence: [params.toolName],
    intentAnomalyTags: intentTags,
    violatedCapabilities: params.violatedCapabilities,
    riskScore: 0,
    killSwitchTriggered: false,
  });
}

export function inferIntentTags(userIntent: string): string[] {
  const intent = userIntent.toLowerCase();
  const tags: string[] = [];
  if (/invoice|billing|receipt|fatura/.test(intent)) tags.push('invoice');
  if (/check|view|inspect|lookup|read|summary/.test(intent)) tags.push('read');
  if (/export|download|dump|extract/.test(intent)) tags.push('export');
  if (/pay|transfer|charge|refund/.test(intent)) tags.push('payment');
  if (/search|find|lookup/.test(intent)) tags.push('search');
  if (/run|execute|deploy|restart/.test(intent)) tags.push('execute');
  if (/database|sql|query|db/.test(intent)) tags.push('database');
  return tags.length > 0 ? tags : ['general'];
}

export function createSignatureId(): string {
  return `TS-${randomBytes(4).toString('hex').toUpperCase()}`;
}
