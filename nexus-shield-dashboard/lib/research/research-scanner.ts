import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { runAgentSecurityScan, type AgentSecurityReport } from '@/lib/scanner';
import { computeAuditVerificationHash } from '@/lib/reports/audit-verification-hash';
import type {
  AuditTrailCapability,
  IntentDivergenceRisk,
  ParameterValidationStatus,
  ResearchScanRow,
  ResearchTarget,
} from '@/lib/research/types';

const SCHEMA_KEYWORDS = [
  'jsonschema',
  'json_schema',
  'zod',
  'pydantic',
  'parameters',
  'input_schema',
  'validate',
  'strict',
];

const WEAK_VALIDATION_KEYWORDS = ['optional', 'any', 'unknown', 'unvalidated'];

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'NexusShield-Research/2026',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchGithubJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: githubHeaders(), signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchRawFile(owner: string, repo: string, filePath: string): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const data = await fetchGithubJson<{ content?: string; encoding?: string }>(url);
  if (!data?.content || data.encoding !== 'base64') return '';
  return Buffer.from(data.content, 'base64').toString('utf8');
}

async function listDirectory(owner: string, repo: string, dirPath: string): Promise<string[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}`;
  const data = await fetchGithubJson<Array<{ name: string; type: string; path: string }>>(url);
  if (!Array.isArray(data)) return [];
  return data.map((entry) => entry.path);
}

export async function fetchTargetSurface(target: ResearchTarget): Promise<{
  surfaceText: string;
  status: 'ok' | 'partial' | 'error';
  error?: string;
}> {
  const [owner, repo] = target.github.split('/');
  const chunks: string[] = [target.githubUrl, target.slug, target.name];
  let fetchedAny = false;

  const candidatePaths = [
    target.contentPath,
    '',
    'src',
    'packages',
    'agents',
    'tools',
    'prompts',
    'examples',
  ].filter(Boolean) as string[];

  const fileCandidates = [
    'README.md',
    'package.json',
    'pyproject.toml',
    'mcp.json',
    'agent.json',
    'tools.json',
    'docker-compose.yml',
  ];

  for (const dir of candidatePaths) {
    const listing = await listDirectory(owner, repo, dir);
    if (listing.length > 0) {
      fetchedAny = true;
      chunks.push(JSON.stringify(listing));
    }

    for (const fileName of fileCandidates) {
      const filePath = dir ? `${dir}/${fileName}` : fileName;
      const content = await fetchRawFile(owner, repo, filePath);
      if (content) {
        fetchedAny = true;
        chunks.push(`\n--- ${filePath} ---\n${content.slice(0, 24_000)}`);
      }
    }
  }

  if (!fetchedAny) {
    return {
      surfaceText: chunks.join('\n'),
      status: 'error',
      error: 'Unable to fetch repository contents via GitHub API',
    };
  }

  return {
    surfaceText: chunks.join('\n'),
    status: chunks.join('\n').length > 500 ? 'ok' : 'partial',
  };
}

export function deriveParameterValidation(
  report: AgentSecurityReport,
  surfaceText: string,
): ParameterValidationStatus {
  const lower = surfaceText.toLowerCase();
  const hasSchema = SCHEMA_KEYWORDS.some((k) => lower.includes(k));
  const hasHijackFinding = report.findings.some((f) => f.category === 'parameter_hijack');
  const hasWeak = WEAK_VALIDATION_KEYWORDS.some((k) => lower.includes(k));

  if (hasSchema && !hasHijackFinding && !hasWeak) return 'Enforced';
  if (hasSchema || hasWeak) return 'Weak';
  return 'Missing';
}

export function derivePrivilegeLevel(surfaceText: string): string[] {
  const lower = surfaceText.toLowerCase();
  const levels: string[] = [];
  if (/\b(delete|drop_table|insert|update|postgres|mongodb|sqlite|redis)\b/i.test(lower)) {
    levels.push('DB Write');
  }
  if (/\b(shell|bash|exec|subprocess|run_command|docker|kubernetes)\b/i.test(lower)) {
    levels.push('Shell Exec');
  }
  if (/\b(read_file|write_file|filesystem|admin|sudo|root|\*:\*)\b/i.test(lower)) {
    levels.push('Admin File Access');
  }
  return levels.length > 0 ? levels : ['Read-Only (inferred)'];
}

export function deriveIntentDivergenceRisk(report: AgentSecurityReport): IntentDivergenceRisk {
  if (!report.attackSurface.intentVerificationPresent) {
    const criticalIntent = report.findings.some(
      (f) => f.category === 'intent_verification' && f.severity === 'critical',
    );
    return criticalIntent ? 'High' : 'Medium';
  }
  if (report.findings.some((f) => f.category === 'intent_verification')) return 'Medium';
  return 'Low';
}

export function deriveAuditTrail(report: AgentSecurityReport): AuditTrailCapability {
  return report.attackSurface.evidenceChainPresent ? 'Present' : 'Absent';
}

export function enrichResearchRow(
  target: ResearchTarget,
  report: AgentSecurityReport,
  surfaceText: string,
  fetchStatus: 'ok' | 'partial' | 'error',
  fetchError?: string,
): ResearchScanRow {
  return {
    id: target.id,
    slug: target.slug,
    name: target.name,
    category: target.category,
    github: target.github,
    githubUrl: target.githubUrl,
    securityScore: report.score,
    grade: report.grade,
    parameterValidationStatus: deriveParameterValidation(report, surfaceText),
    privilegeLevel: derivePrivilegeLevel(surfaceText),
    intentDivergenceRisk: deriveIntentDivergenceRisk(report),
    auditTrailCapability: deriveAuditTrail(report),
    auditHash: computeAuditVerificationHash(report),
    scannedAt: report.scannedAt,
    latencyMs: report.latencyMs,
    fetchStatus,
    fetchError,
    findingsCount: report.findings.length,
    report,
  };
}

export async function scanResearchTarget(
  target: ResearchTarget,
  tempRoot: string,
): Promise<ResearchScanRow> {
  const fetchResult = await fetchTargetSurface(target);
  const targetDir = path.join(tempRoot, target.id.replace(/[^\w-]/g, '_'));
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, 'surface.txt'), fetchResult.surfaceText, 'utf8');

  const report =
    fetchResult.surfaceText.length > 200
      ? await runAgentSecurityScan({
          inputType: 'mcp',
          target: target.slug,
          mcpConfig: JSON.stringify({
            source: target.slug,
            content: fetchResult.surfaceText.slice(0, 80_000),
          }),
        })
      : await runAgentSecurityScan({
          inputType: 'github',
          target: target.githubUrl,
        });

  return enrichResearchRow(
    target,
    report,
    fetchResult.surfaceText,
    fetchResult.status,
    fetchResult.error,
  );
}

export function computeReportVerificationHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
