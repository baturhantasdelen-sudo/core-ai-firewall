import type { OwaspReference, OwaspThreatClassification } from '@/types/owasp';

export type { OwaspReference, OwaspThreatClassification };

export const OWASP_REFERENCES: OwaspReference[] = [
  {
    title: 'OWASP Top 10 for LLM Applications (GenAI)',
    url: 'https://genai.owasp.org/llmrisk/llm01-prompt-injection/',
  },
  {
    title: 'OWASP Agentic AI — Threats and Mitigations',
    url: 'https://owasp.org/www-project-agentic-ai/',
  },
  {
    title: 'OWASP AI Agent Security Cheat Sheet',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html',
  },
];

const CATEGORY_MAP: Record<string, Pick<OwaspThreatClassification, 'owasp_genai_top_10' | 'owasp_agentic'>> = {
  INDIRECT_PROMPT_INJECTION: {
    owasp_genai_top_10: ['LLM01:2025 Prompt Injection'],
    owasp_agentic: ['ASI-01: Agent Goal / Parameter Hijacking'],
  },
  CROSS_TOOL_EXFILTRATION: {
    owasp_genai_top_10: ['LLM02:2025 Sensitive Information Disclosure', 'LLM06:2025 Excessive Agency'],
    owasp_agentic: ['ASI-02: Cross-Tool Data Leakage', 'ASI-04: Unsafe Tool Chaining'],
  },
  PRIVILEGE_ESCALATION: {
    owasp_genai_top_10: ['LLM06:2025 Excessive Agency', 'LLM05:2025 Improper Output Handling'],
    owasp_agentic: ['ASI-03: Permission & Scope Violation'],
  },
  MCP_HIJACK: {
    owasp_genai_top_10: ['LLM01:2025 Prompt Injection', 'LLM06:2025 Excessive Agency'],
    owasp_agentic: ['ASI-01: Agent Goal / Parameter Hijacking'],
  },
};

const VIOLATION_RULES: Array<{ pattern: RegExp; tags: Pick<OwaspThreatClassification, 'owasp_genai_top_10' | 'owasp_agentic'> }> = [
  {
    pattern: /EXFIL|webhook|SELECT \* FROM/i,
    tags: {
      owasp_genai_top_10: ['LLM02:2025 Sensitive Information Disclosure'],
      owasp_agentic: ['ASI-02: Cross-Tool Data Leakage'],
    },
  },
  {
    pattern: /HIGH_RISK_TOOL|HIJACK|export_customer/i,
    tags: {
      owasp_genai_top_10: ['LLM06:2025 Excessive Agency'],
      owasp_agentic: ['ASI-01: Agent Goal / Parameter Hijacking'],
    },
  },
  {
    pattern: /INJECTION|ignore prior|SYSTEM:/i,
    tags: {
      owasp_genai_top_10: ['LLM01:2025 Prompt Injection'],
      owasp_agentic: ['ASI-01: Agent Goal / Parameter Hijacking'],
    },
  },
];

function mergeTags(
  base: Pick<OwaspThreatClassification, 'owasp_genai_top_10' | 'owasp_agentic'>,
  extra: Pick<OwaspThreatClassification, 'owasp_genai_top_10' | 'owasp_agentic'>,
): Pick<OwaspThreatClassification, 'owasp_genai_top_10' | 'owasp_agentic'> {
  return {
    owasp_genai_top_10: [...new Set([...base.owasp_genai_top_10, ...extra.owasp_genai_top_10])],
    owasp_agentic: [...new Set([...base.owasp_agentic, ...extra.owasp_agentic])],
  };
}

export function classifyOwaspThreat(category: string, violations: string[] = []): OwaspThreatClassification {
  const normalized = category.toUpperCase().replace(/\s+/g, '_');
  const base = CATEGORY_MAP[normalized] ?? CATEGORY_MAP.MCP_HIJACK;
  let merged = { ...base, owasp_genai_top_10: [...base.owasp_genai_top_10], owasp_agentic: [...base.owasp_agentic] };
  const blob = violations.join(' ');

  for (const rule of VIOLATION_RULES) {
    if (rule.pattern.test(blob)) {
      merged = mergeTags(merged, rule.tags);
    }
  }

  return {
    ...merged,
    primary_category: normalized,
    references: OWASP_REFERENCES,
  };
}

export const OWASP_STANDARDS_ALIGNMENT = {
  frameworks: ['OWASP GenAI Top 10', 'OWASP Agentic AI Threats & Mitigations'],
  references: OWASP_REFERENCES,
  compliance_note:
    'Nexus Shield detections emit OWASP-aligned classification tags for audit export. Tags indicate mapped threat families; formal certification requires customer GRC review.',
} as const;

export function inferThreatCategory(violations: string[], toolName = ''): string {
  const blob = `${violations.join(' ')} ${toolName}`;
  if (/EXFIL|webhook|SELECT \* FROM|export_customer|bulk_export/i.test(blob)) {
    return 'CROSS_TOOL_EXFILTRATION';
  }
  if (/Capability revoked|Agent lacks required|READ_ONLY|FROZEN/i.test(blob)) {
    return 'PRIVILEGE_ESCALATION';
  }
  if (/divergence|injection|ignore prior|INTENT/i.test(blob)) {
    return 'INDIRECT_PROMPT_INJECTION';
  }
  return 'MCP_HIJACK';
}

export const RUNTIME_PRIVACY_METADATA = {
  inspection_model: 'on_device_sub_millisecond_token_inspection',
  external_cloud_proxy: false,
  data_residency: 'customer_runtime_boundary',
  suitable_for: ['restricted_enterprise', 'public_sector', 'defense_and_critical_infrastructure'],
  description:
    'Tool-call and token-level policy evaluation runs locally at the agent runtime boundary without routing prompts or tool payloads through Nexus Shield cloud proxies.',
} as const;
