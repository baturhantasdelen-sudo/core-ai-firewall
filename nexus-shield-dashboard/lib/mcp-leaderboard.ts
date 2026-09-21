import type {
  McpHarnessGrade,
  McpLeaderboardAdapter,
  McpLeaderboardRaw,
  McpLeaderboardScenario,
  McpLeaderboardView,
} from '@/types/mcp-leaderboard';
import fallbackData from '@/data/mcp_leaderboard.json';

const ADAPTER_META: Record<
  string,
  { adapter_name: string; target_vectors: string[] }
> = {
  'mcp-hijack-postgres-exfil': {
    adapter_name: '@modelcontextprotocol/server-postgres',
    target_vectors: ['Data-to-Tool Hijack', 'SQL Exfiltration'],
  },
  'mcp-hijack-filesystem-traversal': {
    adapter_name: '@modelcontextprotocol/server-filesystem',
    target_vectors: ['Path Traversal', 'Unauthorized Write'],
  },
  'mcp-hijack-slack-github-leak': {
    adapter_name: 'slack + github (cross-tool)',
    target_vectors: ['Cross-Tool Exfiltration', 'Secret Enumeration'],
  },
  'mcp-hijack-github-pr-poison': {
    adapter_name: 'github',
    target_vectors: ['PR Poisoning', 'Pipeline Hijack'],
  },
  'mcp-hijack-fetch-ssrf': {
    adapter_name: '@modelcontextprotocol/server-fetch',
    target_vectors: ['SSRF', 'HTTP Exfiltration'],
  },
};

function averageGradeScore(grades: McpHarnessGrade[]): McpHarnessGrade {
  const scoreMap: Record<McpHarnessGrade, number> = {
    'A+': 98,
    A: 94,
    B: 88,
    C: 75,
    D: 60,
    F: 40,
  };
  const reverse: McpHarnessGrade[] = ['F', 'D', 'C', 'B', 'A', 'A+'];
  if (grades.length === 0) return 'F';
  const avg = grades.reduce((sum, grade) => sum + scoreMap[grade], 0) / grades.length;
  return reverse.find((grade) => scoreMap[grade] <= avg) ?? 'F';
}

function buildAdapters(scenarios: McpLeaderboardScenario[]): McpLeaderboardAdapter[] {
  const grouped = new Map<string, McpLeaderboardScenario[]>();

  for (const scenario of scenarios) {
    const meta = ADAPTER_META[scenario.scenario_id];
    const key = meta?.adapter_name ?? scenario.scenario_id;
    const bucket = grouped.get(key) ?? [];
    bucket.push(scenario);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries()).map(([adapter_name, adapterScenarios]) => {
    const meta = adapterScenarios
      .map((scenario) => ADAPTER_META[scenario.scenario_id])
      .find(Boolean);
    const blocked_count = adapterScenarios.filter((scenario) => scenario.blocked).length;
    const violations = Array.from(
      new Set(adapterScenarios.flatMap((scenario) => scenario.violations)),
    );
    const avgScore =
      adapterScenarios.reduce((sum, scenario) => sum + scenario.mcp_sec_score, 0) /
      adapterScenarios.length;

    return {
      adapter_name,
      target_vectors: meta?.target_vectors ?? [adapterScenarios[0]?.category ?? 'MCP Hijack'],
      grade: averageGradeScore(adapterScenarios.map((scenario) => scenario.grade)),
      blocked_count,
      total_count: adapterScenarios.length,
      vulnerabilities_detected: violations,
      protection_status: blocked_count === adapterScenarios.length ? 'protected' : 'vulnerable',
      mcp_sec_score: Math.round(avgScore * 10) / 10,
      scenarios: adapterScenarios,
    };
  });
}

export function normalizeMcpLeaderboard(raw: McpLeaderboardRaw): McpLeaderboardView {
  return {
    mcp_sec_score: raw.mcp_sec_score,
    grade: raw.grade,
    scenarios_evaluated: raw.scenario_count,
    blocked_rate: raw.block_rate_pct,
    blocked_count: raw.blocked_count,
    timestamp_utc: raw.timestamp_utc,
    meets_baseline: raw.baseline_comparison.meets_baseline,
    adapters: buildAdapters(raw.scenarios),
    raw,
  };
}

export function getMcpLeaderboardFallback(): McpLeaderboardView {
  return normalizeMcpLeaderboard(fallbackData as McpLeaderboardRaw);
}

export async function fetchMcpLeaderboard(): Promise<McpLeaderboardView> {
  try {
    const response = await fetch('/data/mcp_leaderboard.json', {
      cache: 'no-store',
    });
    if (!response.ok) {
      return getMcpLeaderboardFallback();
    }
    const raw = (await response.json()) as McpLeaderboardRaw;
    return normalizeMcpLeaderboard(raw);
  } catch {
    return getMcpLeaderboardFallback();
  }
}

export function gradeAccentClass(grade: McpHarnessGrade): string {
  if (grade === 'A+' || grade === 'A') {
    return 'from-emerald-500/20 to-cyan-500/10 text-emerald-300 border-emerald-500/30';
  }
  if (grade === 'B' || grade === 'C') {
    return 'from-amber-500/20 to-orange-500/10 text-amber-300 border-amber-500/30';
  }
  return 'from-rose-500/20 to-red-500/10 text-rose-300 border-rose-500/30';
}
