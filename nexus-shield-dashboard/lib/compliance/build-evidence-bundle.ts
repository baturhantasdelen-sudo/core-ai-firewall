import { createHash } from 'crypto';
import leaderboardFallback from '@/data/mcp_leaderboard.json';
import { SCORECARD_2026 } from '@/lib/scorecard/scorecard-data';
import {
  OWASP_STANDARDS_ALIGNMENT,
  RUNTIME_PRIVACY_METADATA,
} from '@/lib/owasp/threat-mapping';
import { evaluateAgentAction } from '@/lib/engine/action-firewall';
import { buildUniversalActionReceipt } from '@/lib/engine/agent-policy-engine';
import { enrichMcpLeaderboardRaw } from '@/lib/mcp-leaderboard';
import type { UniversalActionReceipt } from '@/types/action-receipt';
import type { ComplianceEvidenceBundle, ComplianceControlRow } from '@/types/compliance-evidence';
import type { McpLeaderboardRaw } from '@/types/mcp-leaderboard';

const CONTROL_CATALOG: Array<Omit<ComplianceControlRow, 'evidence_value' | 'status' | 'collected_at_utc'>> = [
  {
    framework: 'SOC 2',
    control_id: 'CC7.1',
    control_name: 'Vulnerability management — detection & monitoring',
    evidence_key: 'mcp_benchmark.block_rate_pct',
  },
  {
    framework: 'SOC 2',
    control_id: 'CC7.2',
    control_name: 'Security event response — malicious agent actions',
    evidence_key: 'mcp_benchmark.blocked_count',
  },
  {
    framework: 'SOC 2',
    control_id: 'CC6.6',
    control_name: 'Logical access — excessive agency / tool abuse',
    evidence_key: 'owasp_coverage.scenario_count',
  },
  {
    framework: 'ISO 27001:2022',
    control_id: 'A.8.8',
    control_name: 'Management of technical vulnerabilities',
    evidence_key: 'mcp_benchmark.mcp_sec_score',
  },
  {
    framework: 'ISO 27001:2022',
    control_id: 'A.8.9',
    control_name: 'Configuration management — secure agent defaults',
    evidence_key: 'scorecard.headline_stats.ootb_defense_rate_avg_pct',
  },
  {
    framework: 'ISO 27001:2022',
    control_id: 'A.5.23',
    control_name: 'Information security for use of cloud services',
    evidence_key: 'runtime_privacy.external_cloud_proxy',
  },
  {
    framework: 'Nexus AI Risk',
    control_id: 'AIR-01',
    control_name: 'Agentic AI risk assessment (Shadow AI scorecard)',
    evidence_key: 'scorecard.frameworks_evaluated',
  },
  {
    framework: 'Nexus AI Risk',
    control_id: 'AIR-02',
    control_name: 'OWASP GenAI / Agentic threat taxonomy coverage',
    evidence_key: 'owasp_coverage.unique_genai_tags',
  },
];

function resolveEvidenceValue(key: string, ctx: Record<string, unknown>): unknown {
  const parts = key.split('.');
  let node: unknown = ctx;
  for (const part of parts) {
    if (!node || typeof node !== 'object') return null;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function loadLeaderboardRaw(): McpLeaderboardRaw {
  return leaderboardFallback as McpLeaderboardRaw;
}

function buildUniversalActionReceipts(raw: McpLeaderboardRaw): UniversalActionReceipt[] {
  return raw.scenarios.map((scenario) => {
    const toolCall = scenario.tool_calls?.[0];
    const toolName = toolCall?.tool ?? 'unknown';
    const toolArgs = (toolCall?.arguments as Record<string, unknown>) ?? {};
    const agentId = `bench-${scenario.scenario_id}`;
    const firewall = evaluateAgentAction({
      agentId,
      userIntent: scenario.scenario_name,
      toolCall: { name: toolName, args: toolArgs },
      agentCapabilities: ['READ', 'API_CALL'],
    });
    return buildUniversalActionReceipt(
      {
        agentId,
        userIntent: scenario.scenario_name,
        toolName,
        toolArgs,
      },
      firewall,
    );
  });
}

function buildOwaspCoverage(raw: McpLeaderboardRaw) {
  const genai = new Set<string>();
  const agentic = new Set<string>();
  const scenarios = raw.scenarios.map((scenario) => {
    const tags = scenario.owasp;
    for (const tag of tags?.owasp_genai_top_10 ?? []) genai.add(tag);
    for (const tag of tags?.owasp_agentic ?? []) agentic.add(tag);
    return {
      scenario_id: scenario.scenario_id,
      name: scenario.scenario_name,
      blocked: scenario.blocked,
      mcp_sec_score: scenario.mcp_sec_score,
      owasp_genai_top_10: tags?.owasp_genai_top_10 ?? [],
      owasp_agentic: tags?.owasp_agentic ?? [],
      evidence_hash: scenario.evidence_hash,
    };
  });

  return {
    scenario_count: scenarios.length,
    unique_genai_tags: [...genai].sort(),
    unique_agentic_tags: [...agentic].sort(),
    scenarios,
  };
}

export function buildComplianceEvidenceBundle(): ComplianceEvidenceBundle {
  const raw = enrichMcpLeaderboardRaw(loadLeaderboardRaw());
  const owasp_coverage = buildOwaspCoverage(raw);

  const mcp_benchmark = {
    mcp_sec_score: raw.mcp_sec_score,
    grade: raw.grade,
    block_rate_pct: raw.block_rate_pct,
    blocked_count: raw.blocked_count,
    scenario_count: raw.scenario_count,
    timestamp_utc: raw.timestamp_utc,
    latency_ms: raw.latency_ms,
    meets_proof_center_baseline: raw.baseline_comparison.meets_baseline,
  };

  const scorecard = {
    present: true,
    report_id: SCORECARD_2026.report_id,
    frameworks_evaluated: SCORECARD_2026.frameworks.length,
    headline_stats: SCORECARD_2026.headline_stats as unknown as Record<string, unknown>,
    nexus_shield_mitigation_avg_pct: SCORECARD_2026.headline_stats.nexus_shield_mitigation_avg_pct,
    ootb_defense_rate_avg_pct: SCORECARD_2026.headline_stats.ootb_defense_rate_avg_pct,
  };

  const runtime_privacy = raw.runtime_privacy ?? {
    ...RUNTIME_PRIVACY_METADATA,
    suitable_for: [...RUNTIME_PRIVACY_METADATA.suitable_for],
  };

  const ctx: Record<string, unknown> = {
    mcp_benchmark,
    scorecard,
    owasp_coverage,
    runtime_privacy,
  };

  const collectedAt = new Date().toISOString();
  const automated_controls: ComplianceControlRow[] = CONTROL_CATALOG.map((control) => {
    const evidence_value = resolveEvidenceValue(control.evidence_key, ctx);
    let status: ComplianceControlRow['status'] =
      evidence_value !== null && evidence_value !== undefined && evidence_value !== ''
        ? 'pass'
        : 'needs_review';
    if (control.evidence_key === 'runtime_privacy.external_cloud_proxy' && evidence_value === false) {
      status = 'pass';
    }
    return {
      ...control,
      evidence_value,
      status,
      collected_at_utc: collectedAt,
    };
  });

  const standards_alignment = raw.standards_alignment ?? {
    frameworks: [...OWASP_STANDARDS_ALIGNMENT.frameworks],
    references: [...OWASP_STANDARDS_ALIGNMENT.references],
    compliance_note: OWASP_STANDARDS_ALIGNMENT.compliance_note,
  };

  const universal_action_receipts = buildUniversalActionReceipts(raw);

  const bundleWithoutIntegrity: Omit<ComplianceEvidenceBundle, 'integrity'> = {
    bundle_id: 'nexusshield-compliance-evidence',
    bundle_version: '1.1.0',
    generated_at_utc: collectedAt,
    producer: 'nexus-shield-dashboard/compliance-evidence-api',
    standards_alignment,
    runtime_privacy,
    mcp_benchmark,
    scorecard,
    owasp_coverage,
    automated_controls,
    universal_action_receipts,
    integrations: {
      vanta_drata_secureframe: {
        ingest_method: 'HTTPS GET polling',
        recommended_path: '/api/v1/compliance/evidence',
        auth: 'x-api-key or x-compliance-monitor-token',
        formats: ['json', 'csv'],
      },
    },
  };

  const sha256 = createHash('sha256')
    .update(JSON.stringify(bundleWithoutIntegrity))
    .digest('hex');

  return { ...bundleWithoutIntegrity, integrity: { sha256 } };
}

export function complianceBundleToCsvControls(bundle: ComplianceEvidenceBundle): string {
  const header = [
    'framework',
    'control_id',
    'control_name',
    'status',
    'evidence_value',
    'evidence_key',
    'collected_at_utc',
  ];
  const lines = [header.join(',')];
  for (const row of bundle.automated_controls) {
    lines.push(
      [
        row.framework,
        row.control_id,
        `"${row.control_name.replace(/"/g, '""')}"`,
        row.status,
        `"${String(row.evidence_value ?? '').replace(/"/g, '""')}"`,
        row.evidence_key,
        row.collected_at_utc,
      ].join(','),
    );
  }
  return lines.join('\n');
}
