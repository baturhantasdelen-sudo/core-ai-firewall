/**
 * Free AI Agent & MCP security scanner — static/heuristic analysis for
 * Attack → Prove → Install → Protect growth funnel.
 */

export type ScanInputType = 'endpoint' | 'mcp' | 'github';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export type FindingCategory =
  | 'excessive_authority'
  | 'unsigned_actions'
  | 'intent_verification'
  | 'tool_misuse'
  | 'parameter_hijack'
  | 'evidence_chain';

export interface SecurityFinding {
  id: string;
  title: string;
  severity: FindingSeverity;
  category: FindingCategory;
  description: string;
  recommendation: string;
  sdkFix?: string;
}

export interface AgentSecurityReport {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  inputType: ScanInputType;
  target: string;
  scannedAt: string;
  latencyMs: number;
  findings: SecurityFinding[];
  summary: Record<FindingSeverity, number>;
  attackSurface: {
    toolsDetected: number;
    unsignedActions: number;
    evidenceChainPresent: boolean;
    intentVerificationPresent: boolean;
  };
}

export interface ScanRequest {
  inputType: ScanInputType;
  target: string;
  /** Optional raw MCP JSON or pasted config */
  mcpConfig?: string;
}

const DANGEROUS_TOOL_PATTERNS: Array<{ pattern: RegExp; title: string; severity: FindingSeverity }> = [
  { pattern: /\b(shell|bash|exec|run_command|subprocess|os\.system)\b/i, title: 'Arbitrary shell execution tool', severity: 'critical' },
  { pattern: /\b(delete|drop_table|rm\s+-rf|wipe|destroy)\b/i, title: 'Destructive action without guardrails', severity: 'critical' },
  { pattern: /\b(transfer|payout|stripe|wire|payment)\b/i, title: 'Financial transfer capability exposed', severity: 'high' },
  { pattern: /\b(bulk_export|exfil|upload|webhook|http_post)\b/i, title: 'Data exfiltration vector', severity: 'high' },
  { pattern: /\b(read_file|write_file|fs\.|filesystem)\b/i, title: 'Unscoped filesystem access', severity: 'medium' },
];

const HIJACK_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(prior|previous)\s+instructions/i,
  /system\s*override/i,
  /\{\{.*\}\}/,
  /;\s*curl\s+/i,
  /parameter\s*injection/i,
];

const EVIDENCE_KEYWORDS = [
  'evidence',
  'proof',
  'audit_trail',
  'cryptographic',
  'sha256',
  'merkle',
  'immutable',
  'nexus',
  'action_firewall',
];

const INTENT_KEYWORDS = [
  'intent',
  'verify_intent',
  'action_verification',
  'tool_consistency',
  'trajectory',
  'kill_switch',
];

function severityWeight(severity: FindingSeverity): number {
  switch (severity) {
    case 'critical':
      return 25;
    case 'high':
      return 15;
    case 'medium':
      return 8;
    case 'low':
      return 3;
  }
}

function deriveGrade(score: number): AgentSecurityReport['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function summarize(findings: SecurityFinding[]): Record<FindingSeverity, number> {
  return findings.reduce(
    (acc, f) => {
      acc[f.severity] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<FindingSeverity, number>,
  );
}

function computeScore(findings: SecurityFinding[]): number {
  const penalty = findings.reduce((sum, f) => sum + severityWeight(f.severity), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function pushFinding(
  findings: SecurityFinding[],
  seen: Set<string>,
  finding: Omit<SecurityFinding, 'id'>,
): void {
  const key = `${finding.category}:${finding.title}`;
  if (seen.has(key)) return;
  seen.add(key);
  findings.push({
    ...finding,
    id: `NS-F${String(findings.length + 1).padStart(3, '0')}`,
    sdkFix: finding.sdkFix ?? 'nexus.shield({ intentVerification: true, evidenceChain: true })',
  });
}

function analyzeTextSurface(text: string, findings: SecurityFinding[], seen: Set<string>): void {
  const lower = text.toLowerCase();

  if (!INTENT_KEYWORDS.some((k) => lower.includes(k))) {
    pushFinding(findings, seen, {
      title: 'Missing Intent-Action Verification',
      severity: 'critical',
      category: 'intent_verification',
      description:
        'No intent verification, trajectory guard, or action consistency layer detected in configuration.',
      recommendation:
        'Enable Runtime Action Governance with Policy Enforcement, Universal Action Receipts, and Cryptographic Verification on every tool invocation.',
      sdkFix: 'NexusShield.evaluateAction({ userIntent, toolCall, agentCapabilities })',
    });
  }

  if (!EVIDENCE_KEYWORDS.some((k) => lower.includes(k))) {
    pushFinding(findings, seen, {
      title: 'Lack of Cryptographic Evidence Chain',
      severity: 'high',
      category: 'evidence_chain',
      description:
        'No immutable audit trail, proof hash, or evidence chain configuration found for agent actions.',
      recommendation:
        'Attach cryptographic evidence to every blocked/allowed action for SOC2 and EU AI Act audit readiness.',
      sdkFix: 'NexusShield.attachEvidence({ actionId, sha256Proof: true })',
    });
  }

  if (/api[_-]?key\s*[:=]\s*['"]?[a-z0-9_-]{8,}/i.test(text)) {
    pushFinding(findings, seen, {
      title: 'Hardcoded API Authority in Config',
      severity: 'critical',
      category: 'excessive_authority',
      description: 'Static API keys or secrets embedded in agent/MCP configuration increase blast radius.',
      recommendation: 'Use JIT credentials and rotate keys via Nexus Shield credential vault.',
    });
  }

  if (/\b(admin|root|sudo|superuser|wildcard|\*:\*)\b/i.test(text)) {
    pushFinding(findings, seen, {
      title: 'Excessive API Authority Scope',
      severity: 'high',
      category: 'excessive_authority',
      description: 'Broad admin/root scopes detected — agent can exceed least-privilege boundaries.',
      recommendation: 'Scope tools per-agent with capability manifests and deny-by-default policies.',
    });
  }

  for (const hijack of HIJACK_PATTERNS) {
    if (hijack.test(text)) {
      pushFinding(findings, seen, {
        title: 'Parameter Hijack / Injection Surface',
        severity: 'high',
        category: 'parameter_hijack',
        description:
          'Patterns associated with prompt injection or parameter smuggling found in agent surface.',
        recommendation: 'Sanitize tool arguments and enforce schema validation at the Action Firewall.',
      });
      break;
    }
  }

  for (const { pattern, title, severity } of DANGEROUS_TOOL_PATTERNS) {
    if (pattern.test(text)) {
      pushFinding(findings, seen, {
        title,
        severity,
        category: 'tool_misuse',
        description: `Dangerous capability "${pattern.source}" exposed without runtime interception.`,
        recommendation: 'Wrap tool registry with Nexus Shield SDK and require signed action approvals.',
      });
    }
  }

  if (/unsigned|no[_-]?auth|skip[_-]?verification|trust[_-]?all/i.test(text)) {
    pushFinding(findings, seen, {
      title: 'Unsigned Actions Permitted',
      severity: 'critical',
      category: 'unsigned_actions',
      description: 'Configuration suggests actions may execute without cryptographic or policy signatures.',
      recommendation: 'Require signed action tokens for every tool call via Nexus Shield SDK.',
    });
  }
}

function analyzeMcpConfig(raw: string, findings: SecurityFinding[], seen: Set<string>): number {
  let tools = 0;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const blob = JSON.stringify(parsed, null, 2);
    analyzeTextSurface(blob, findings, seen);

    const servers = (parsed.mcpServers ?? parsed.servers ?? parsed) as Record<string, unknown>;
    if (typeof servers === 'object' && servers !== null) {
      tools = Object.keys(servers).length;
    }

    if (Array.isArray(parsed.tools)) {
      tools = Math.max(tools, parsed.tools.length);
      for (const tool of parsed.tools) {
        const name = typeof tool === 'object' && tool && 'name' in tool ? String((tool as { name: string }).name) : '';
        if (name) analyzeTextSurface(name, findings, seen);
      }
    }
  } catch {
    analyzeTextSurface(raw, findings, seen);
  }
  return tools;
}

async function fetchGithubSurface(repoUrl: string): Promise<string> {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
  if (!match) return repoUrl;

  const [, owner, repoRaw] = match;
  const repo = repoRaw.replace(/\.git$/, '');
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'NexusShield-Scanner/1.0',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const endpoints = [
    `https://api.github.com/repos/${owner}/${repo}/contents/`,
    `https://api.github.com/repos/${owner}/${repo}/contents/agent`,
    `https://api.github.com/repos/${owner}/${repo}/contents/src`,
  ];

  const chunks: string[] = [repoUrl];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = (await res.json()) as unknown;
      chunks.push(JSON.stringify(data));
    } catch {
      // continue with heuristics on URL
    }
  }
  return chunks.join('\n');
}

async function probeEndpoint(endpoint: string): Promise<string> {
  const chunks: string[] = [endpoint];
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json, text/plain, */*' },
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.text();
    chunks.push(`status:${res.status}`);
    chunks.push(...Array.from(res.headers.entries()).map(([k, v]) => `${k}:${v}`));
    chunks.push(body.slice(0, 12000));
  } catch {
    // offline heuristics only
  }
  return chunks.join('\n');
}

export async function runAgentSecurityScan(request: ScanRequest): Promise<AgentSecurityReport> {
  const started = Date.now();
  const findings: SecurityFinding[] = [];
  const seen = new Set<string>();
  let toolsDetected = 0;
  let surfaceText = request.target;

  switch (request.inputType) {
    case 'mcp':
      surfaceText = request.mcpConfig?.trim() || request.target;
      toolsDetected = analyzeMcpConfig(surfaceText, findings, seen);
      break;
    case 'github':
      surfaceText = await fetchGithubSurface(request.target);
      analyzeTextSurface(surfaceText, findings, seen);
      toolsDetected = (surfaceText.match(/"name"\s*:/g) ?? []).length;
      break;
    case 'endpoint':
      surfaceText = await probeEndpoint(request.target);
      analyzeTextSurface(surfaceText, findings, seen);
      toolsDetected = (surfaceText.match(/\/tools|tool_call|function_call/gi) ?? []).length;
      break;
  }

  if (findings.length === 0) {
    pushFinding(findings, seen, {
      title: 'Baseline Hardening Recommended',
      severity: 'medium',
      category: 'intent_verification',
      description:
        'No critical misconfigurations detected via static analysis — deploy runtime Action Firewall for live protection.',
      recommendation: 'Install Nexus Shield SDK to intercept tool calls in production with sub-10ms latency.',
    });
  }

  const summary = summarize(findings);
  const score = computeScore(findings);
  const lower = surfaceText.toLowerCase();

  return {
    score,
    grade: deriveGrade(score),
    inputType: request.inputType,
    target: request.target,
    scannedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
    findings,
    summary,
    attackSurface: {
      toolsDetected,
      unsignedActions: summary.critical + summary.high,
      evidenceChainPresent: EVIDENCE_KEYWORDS.some((k) => lower.includes(k)),
      intentVerificationPresent: INTENT_KEYWORDS.some((k) => lower.includes(k)),
    },
  };
}
