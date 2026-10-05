import type { ApprovalThresholdRule, EnterpriseAgentPolicy, WorkGraphDocument } from '@/lib/policy-as-code/types';

const APPROVAL_PATTERN = /^([A-Z0-9_]+)\s*>\s*\$?([\d,]+(?:\.\d+)?)/i;

export function parseEnterprisePolicyDocument(raw: string): EnterpriseAgentPolicy {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    return normalizePolicyJson(JSON.parse(trimmed) as Record<string, unknown>);
  }
  return parseEnterprisePolicyYaml(trimmed);
}

function normalizePolicyJson(data: Record<string, unknown>): EnterpriseAgentPolicy {
  const requires = (data.requires_approval as unknown[]) ?? [];
  return {
    agent: String(data.agent ?? 'unknown-agent'),
    allowed_intents: (data.allowed_intents as string[]) ?? [],
    requires_approval: requires.map(parseApprovalEntry),
    blocked_actions: (data.blocked_actions as string[]) ?? [],
    workgraph: data.workgraph as WorkGraphDocument | undefined,
  };
}

function parseApprovalEntry(entry: unknown): ApprovalThresholdRule {
  if (typeof entry === 'string') {
    const match = entry.match(APPROVAL_PATTERN);
    if (match) {
      return {
        intent: match[1].toUpperCase(),
        amountGreaterThan: Number.parseFloat(match[2].replace(/,/g, '')),
        raw: entry,
      };
    }
    return { intent: entry.toUpperCase(), raw: entry };
  }
  const obj = entry as Record<string, unknown>;
  return {
    intent: String(obj.intent ?? '').toUpperCase(),
    amountGreaterThan:
      typeof obj.amountGreaterThan === 'number' ? obj.amountGreaterThan : undefined,
    raw: JSON.stringify(entry),
  };
}

/** Lightweight YAML subset parser for enterprise policy files (no external deps). */
export function parseEnterprisePolicyYaml(yaml: string): EnterpriseAgentPolicy {
  const policy: EnterpriseAgentPolicy = {
    agent: 'unknown-agent',
    allowed_intents: [],
    requires_approval: [],
    blocked_actions: [],
  };

  let section: 'allowed_intents' | 'requires_approval' | 'blocked_actions' | null = null;

  for (const line of yaml.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const agentMatch = trimmed.match(/^agent:\s*(.+)$/i);
    if (agentMatch) {
      policy.agent = agentMatch[1].trim();
      section = null;
      continue;
    }

    if (/^allowed_intents:/i.test(trimmed)) {
      section = 'allowed_intents';
      continue;
    }
    if (/^requires_approval:/i.test(trimmed)) {
      section = 'requires_approval';
      continue;
    }
    if (/^blocked_actions:/i.test(trimmed)) {
      section = 'blocked_actions';
      continue;
    }
    if (/^workgraph:/i.test(trimmed)) {
      section = null;
      continue;
    }

    const listItem = trimmed.match(/^-\s+(.+)$/);
    if (!listItem || !section) continue;
    const value = listItem[1].trim().replace(/^['"]|['"]$/g, '');

    if (section === 'allowed_intents') policy.allowed_intents.push(value.toUpperCase());
    if (section === 'blocked_actions') policy.blocked_actions.push(value.toUpperCase());
    if (section === 'requires_approval') policy.requires_approval.push(parseApprovalEntry(value));
  }

  return policy;
}

function intentMatchesAllowed(intent: string, allowed: string): boolean {
  const a = allowed.toUpperCase();
  const i = intent.toUpperCase();
  if (i.includes(a) || a.includes(i)) return true;

  const iTokens = new Set(i.split('_').filter(Boolean));
  const aTokens = a.split('_').filter(Boolean);
  if (aTokens.length > 0 && aTokens.every((token) => iTokens.has(token))) return true;

  if (a === 'READ_INVOICE') {
    return /INVOICE|FATURA|BILLING/.test(i) && /READ|RETRIEVE|GET|CHECK|VIEW|LOOKUP/.test(i);
  }
  if (a === 'CREATE_PAYMENT') {
    return /PAYMENT|PAY|TRANSFER|CHARGE/.test(i);
  }

  return false;
}

export function evaluatePolicyGate(
  policy: EnterpriseAgentPolicy,
  parsedIntent: string,
  toolName: string,
  amount?: number,
): { allowed: boolean; requiresApproval: boolean; reason?: string } {
  const intent = parsedIntent.toUpperCase().replace(/\s+/g, '_');
  const tool = toolName.toUpperCase();

  for (const blocked of policy.blocked_actions) {
    const b = blocked.toUpperCase();
    if (intent.includes(b) || tool.includes(b)) {
      return { allowed: false, requiresApproval: false, reason: `blocked_actions: ${blocked}` };
    }
  }

  if (policy.allowed_intents.length > 0) {
    const ok = policy.allowed_intents.some((allowed) => intentMatchesAllowed(intent, allowed));
    if (!ok) {
      return { allowed: false, requiresApproval: false, reason: 'intent not in allowed_intents' };
    }
  }

  for (const rule of policy.requires_approval) {
    if (intent.includes(rule.intent) && rule.amountGreaterThan !== undefined && amount !== undefined) {
      if (amount > rule.amountGreaterThan) {
        return { allowed: true, requiresApproval: true, reason: rule.raw ?? rule.intent };
      }
    }
  }

  return { allowed: true, requiresApproval: false };
}
