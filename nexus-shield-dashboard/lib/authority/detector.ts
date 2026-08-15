import type {
  AgentAuthorityInput,
  AuthorityEdge,
  AuthorityGraph,
  AuthorityNode,
  CombinatorialRiskFinding,
  EffectiveRiskLevel,
} from '@/lib/authority/types';
import { resolveEffectiveRiskLevel } from '@/lib/authority/types';

export type ToolCapabilityClass =
  | 'READ_SENSITIVE'
  | 'HTTP_EGRESS'
  | 'DATABASE_READ'
  | 'DATABASE_WRITE'
  | 'DATABASE_EXPORT'
  | 'FINANCIAL'
  | 'DELETE'
  | 'EXECUTE'
  | 'CREDENTIAL_ACCESS'
  | 'GENERIC';

export interface ClassifiedTool {
  name: string;
  mcpServer: string;
  classes: ToolCapabilityClass[];
}

const TOOL_CLASS_PATTERNS: Array<{ pattern: RegExp; capability: ToolCapabilityClass }> = [
  { pattern: /read_invoice|read_customer|read_pii|fetch_invoice|get_invoice/i, capability: 'READ_SENSITIVE' },
  { pattern: /read_file|read_db|sql_query|select_|fetch_record/i, capability: 'DATABASE_READ' },
  { pattern: /bulk_export|export_db|dump_db|pg_dump|sql_export/i, capability: 'DATABASE_EXPORT' },
  { pattern: /write_db|insert_|update_|modify_db|write_file/i, capability: 'DATABASE_WRITE' },
  { pattern: /send_http|http_request|webhook|post_url|curl_|fetch_url/i, capability: 'HTTP_EGRESS' },
  { pattern: /stripe|payment|financial|swift|erp_pay|billing/i, capability: 'FINANCIAL' },
  { pattern: /delete_|purge|drop_table|s3_delete|remove_all/i, capability: 'DELETE' },
  { pattern: /exec|shell|run_command|subprocess|execute_/i, capability: 'EXECUTE' },
  { pattern: /secret|credential|api_key|token|oauth|password/i, capability: 'CREDENTIAL_ACCESS' },
];

export interface CombinatorialRule {
  id: string;
  kind: CombinatorialRiskFinding['kind'];
  severity: EffectiveRiskLevel;
  required: ToolCapabilityClass[];
  description: (tools: ClassifiedTool[]) => string;
  scoreWeight: number;
}

export const COMBINATORIAL_RULES: CombinatorialRule[] = [
  {
    id: 'read-plus-http-exfil',
    kind: 'DATA_EXFILTRATION_RISK',
    severity: 'CRITICAL',
    required: ['READ_SENSITIVE', 'HTTP_EGRESS'],
    description: (tools) => {
      const read = tools.find((t) => t.classes.includes('READ_SENSITIVE'))?.name ?? 'Read Tool';
      const http = tools.find((t) => t.classes.includes('HTTP_EGRESS'))?.name ?? 'HTTP Tool';
      return `${read} + ${http} enables sensitive data egress via outbound HTTP`;
    },
    scoreWeight: 35,
  },
  {
    id: 'db-read-plus-http-exfil',
    kind: 'DATA_EXFILTRATION_RISK',
    severity: 'HIGH',
    required: ['DATABASE_READ', 'HTTP_EGRESS'],
    description: (tools) => {
      const read = tools.find((t) => t.classes.includes('DATABASE_READ'))?.name ?? 'DB Read';
      const http = tools.find((t) => t.classes.includes('HTTP_EGRESS'))?.name ?? 'HTTP';
      return `${read} + ${http} can chain database reads to external endpoints`;
    },
    scoreWeight: 28,
  },
  {
    id: 'read-plus-export-implicit',
    kind: 'IMPLICIT_DATA_ACCESS',
    severity: 'HIGH',
    required: ['READ_SENSITIVE', 'DATABASE_EXPORT'],
    description: (tools) => {
      const read = tools.find((t) => t.classes.includes('READ_SENSITIVE'))?.name ?? 'Read';
      const exp = tools.find((t) => t.classes.includes('DATABASE_EXPORT'))?.name ?? 'Export';
      return `${read} + ${exp} creates implicit bulk data access beyond declared read scope`;
    },
    scoreWeight: 30,
  },
  {
    id: 'financial-plus-http',
    kind: 'FINANCIAL_ABUSE_RISK',
    severity: 'CRITICAL',
    required: ['FINANCIAL', 'HTTP_EGRESS'],
    description: (tools) => {
      const fin = tools.find((t) => t.classes.includes('FINANCIAL'))?.name ?? 'Financial Tool';
      const http = tools.find((t) => t.classes.includes('HTTP_EGRESS'))?.name ?? 'HTTP Tool';
      return `${fin} + ${http} may route payment actions to untrusted external hosts`;
    },
    scoreWeight: 38,
  },
  {
    id: 'read-plus-delete-escalation',
    kind: 'PRIVILEGE_ESCALATION',
    severity: 'HIGH',
    required: ['READ_SENSITIVE', 'DELETE'],
    description: (tools) => {
      const read = tools.find((t) => t.classes.includes('READ_SENSITIVE'))?.name ?? 'Read';
      const del = tools.find((t) => t.classes.includes('DELETE'))?.name ?? 'Delete';
      return `${read} + ${del} crosses read-only intent into destructive operations`;
    },
    scoreWeight: 32,
  },
  {
    id: 'credential-plus-http',
    kind: 'CREDENTIAL_CHAIN_RISK',
    severity: 'CRITICAL',
    required: ['CREDENTIAL_ACCESS', 'HTTP_EGRESS'],
    description: (tools) => {
      const cred = tools.find((t) => t.classes.includes('CREDENTIAL_ACCESS'))?.name ?? 'Credential Tool';
      const http = tools.find((t) => t.classes.includes('HTTP_EGRESS'))?.name ?? 'HTTP Tool';
      return `${cred} + ${http} can exfiltrate secrets via outbound requests`;
    },
    scoreWeight: 40,
  },
];

export function classifyTool(name: string, mcpServer: string): ClassifiedTool {
  const classes = new Set<ToolCapabilityClass>();
  for (const mapping of TOOL_CLASS_PATTERNS) {
    if (mapping.pattern.test(name)) {
      classes.add(mapping.capability);
    }
  }
  if (classes.size === 0) classes.add('GENERIC');
  return { name, mcpServer, classes: [...classes] };
}

export function classifyAgentTools(input: AgentAuthorityInput): ClassifiedTool[] {
  const tools: ClassifiedTool[] = [];
  for (const connection of input.mcpConnections) {
    for (const toolName of connection.tools) {
      tools.push(classifyTool(toolName, connection.serverName));
    }
  }
  return tools;
}

function ruleMatches(rule: CombinatorialRule, tools: ClassifiedTool[]): boolean {
  return rule.required.every((requiredClass) =>
    tools.some((tool) => tool.classes.includes(requiredClass)),
  );
}

function buildRiskPath(agentName: string, involved: ClassifiedTool[]): string[] {
  return [agentName, ...involved.map((t) => t.name)];
}

export function detectCombinatorialRisks(
  input: AgentAuthorityInput,
  tools?: ClassifiedTool[],
): CombinatorialRiskFinding[] {
  const classified = tools ?? classifyAgentTools(input);
  const findings: CombinatorialRiskFinding[] = [];

  for (const rule of COMBINATORIAL_RULES) {
    if (!ruleMatches(rule, classified)) continue;

    const involved = classified.filter((tool) =>
      rule.required.some((req) => tool.classes.includes(req)),
    );

    findings.push({
      kind: rule.kind,
      severity: rule.severity,
      toolsInvolved: involved.map((t) => t.name),
      description: rule.description(involved),
      path: buildRiskPath(input.name, involved),
      revokeTarget: involved.find((t) =>
        rule.required.slice(1).some((req) => t.classes.includes(req)),
      )?.name,
    });
  }

  return findings;
}

export function hasPrivilegeEscalation(findings: CombinatorialRiskFinding[]): boolean {
  return findings.some(
    (f) =>
      f.kind === 'PRIVILEGE_ESCALATION' ||
      f.kind === 'DATA_EXFILTRATION_RISK' ||
      f.severity === 'CRITICAL',
  );
}

export function scoreCombinatorialRisks(
  findings: CombinatorialRiskFinding[],
  baseScore: number,
): { score: number; level: ReturnType<typeof resolveEffectiveRiskLevel> } {
  let score = baseScore;
  for (const finding of findings) {
    const rule = COMBINATORIAL_RULES.find((r) => r.kind === finding.kind);
    score += rule?.scoreWeight ?? 15;
    if (finding.severity === 'CRITICAL') score += 10;
  }
  const normalized = Math.min(100, Math.round(score));
  return { score: normalized, level: resolveEffectiveRiskLevel(normalized) };
}

/** Map combinatorial findings to graph edges for visualization hints. */
export function annotateGraphWithRisks(
  graph: AuthorityGraph,
  findings: CombinatorialRiskFinding[],
): AuthorityGraph {
  if (findings.length === 0) return graph;

  const riskNodes: AuthorityNode[] = findings.map((finding, index) => ({
    id: `${graph.agentId}:risk:${finding.kind}:${index}`,
    label: finding.kind.replace(/_/g, ' '),
    type: 'DataAsset',
    riskWeight: finding.severity === 'CRITICAL' ? 40 : 25,
    metadata: { severity: finding.severity, tools: finding.toolsInvolved.join(', ') },
  }));

  const riskEdges: AuthorityEdge[] = riskNodes.map((node, index) => ({
    id: `${graph.agentId}:risk-edge:${index}`,
    sourceId: graph.nodes.find((n) => n.type === 'Agent')?.id ?? graph.agentId,
    targetId: node.id,
    relation: 'accesses',
    metadata: { combinatorial: findings[index]?.kind ?? '' },
  }));

  return {
    ...graph,
    nodes: [...graph.nodes, ...riskNodes],
    edges: [...graph.edges, ...riskEdges],
    combinatorialRisks: findings,
    privilegeEscalationDetected: hasPrivilegeEscalation(findings),
  };
}
