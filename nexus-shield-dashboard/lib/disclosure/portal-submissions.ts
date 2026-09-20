import { readFile } from 'fs/promises';
import path from 'path';
import type { OutboundDisclosureBatch, OutboundDisclosureRow } from '@/lib/disclosure/types';

export type PortalTargetId = 'activepieces' | 'n8n';

export type PortalSubmissionStatus = 'submitted' | 'manual_required' | 'failed' | 'skipped';

export interface PortalConfig {
  id: PortalTargetId;
  label: string;
  batchOrganizationName: string;
  manualSubmissionUrl: string;
  github?: { owner: string; repo: string };
  webhookEnvKey?: string;
}

export interface PortalSubmissionResult {
  portalId: PortalTargetId;
  label: string;
  status: PortalSubmissionStatus;
  method: 'github_api' | 'webhook' | 'manual';
  submissionUrl: string;
  reportId?: string;
  httpStatus?: number;
  error?: string;
  payloadLog?: unknown;
}

export const ADVISORY_SUMMARY =
  '[CONFIDENTIAL] Parameter Hijacking Risk in Agent / Tool-Calling Gateway';

export const PORTAL_TARGETS: PortalConfig[] = [
  {
    id: 'activepieces',
    label: 'Activepieces',
    batchOrganizationName: 'Activepieces Finance MCP',
    manualSubmissionUrl:
      'https://github.com/activepieces/activepieces/security/advisories/new',
    github: { owner: 'activepieces', repo: 'activepieces' },
  },
  {
    id: 'n8n',
    label: 'n8n',
    batchOrganizationName: 'n8n Open Banking Workflows',
    manualSubmissionUrl: 'https://n8n.io/report-a-vulnerability/',
    github: { owner: 'n8n-io', repo: 'n8n' },
    webhookEnvKey: 'N8N_VDP_WEBHOOK_URL',
  },
];

const BATCH_JSON = path.join(process.cwd(), 'data', 'outbound_disclosure_batch.json');
const GITHUB_API = 'https://api.github.com';
const GITHUB_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

export function getGithubToken(): string | undefined {
  return process.env.GITHUB_TOKEN?.trim() || process.env.GH_PAT?.trim() || undefined;
}

export async function loadOutboundBatch(
  batchPath: string = BATCH_JSON,
): Promise<OutboundDisclosureBatch> {
  const raw = await readFile(batchPath, 'utf8');
  return JSON.parse(raw) as OutboundDisclosureBatch;
}

export function findBatchRow(
  batch: OutboundDisclosureBatch,
  portal: PortalConfig,
): OutboundDisclosureRow | undefined {
  return batch.results.find((row) => row.organizationName === portal.batchOrganizationName);
}

export function emailDraftToMarkdown(emailEn: string): string {
  const lines = emailEn.split('\n');
  const bodyStart = lines.findIndex((line, index) => index > 0 && line.trim() === '');
  const body = bodyStart >= 0 ? lines.slice(bodyStart + 1).join('\n') : emailEn;
  return body.trim();
}

export function mapSeverity(row: OutboundDisclosureRow): 'high' | 'medium' | 'low' {
  if (row.parameterHijackingRisk === 'High') return 'high';
  if (row.parameterHijackingRisk === 'Medium') return 'medium';
  return 'low';
}

export function buildAdvisoryDescription(row: OutboundDisclosureRow): string {
  const body = emailDraftToMarkdown(row.outreach.emailEn);
  return [
    body,
    '',
    '---',
    '',
    '## Technical Evidence',
    '',
    `- Evidence SHA-256: \`${row.evidenceHash}\``,
    `- Security score: ${row.securityScore}/100 (grade ${row.grade})`,
    `- Parameter hijacking risk: ${row.parameterHijackingRisk}`,
    `- Intent divergence score: ${row.intentDivergenceScore}`,
    `- Advisory PDF: ${row.pdfPath}`,
    '',
    '## Coordinated Disclosure',
    '',
    'Submitted under the Nexus Shield Responsible Disclosure Program.',
    'Contact: security@nexusshield.ai',
  ].join('\n');
}

export function buildGithubReportPayload(row: OutboundDisclosureRow) {
  const severity = mapSeverity(row);
  return {
    summary: ADVISORY_SUMMARY,
    description: buildAdvisoryDescription(row),
    severity,
    cwe_ids: ['CWE-20'],
  };
}

export function buildN8nVdpPayload(row: OutboundDisclosureRow) {
  const severity = mapSeverity(row);
  return {
    title: ADVISORY_SUMMARY,
    summary: ADVISORY_SUMMARY,
    description: buildAdvisoryDescription(row),
    severity,
    impact:
      'Unvalidated parameter execution in agent/tool-calling workflows may allow parameter hijacking and unintended privileged actions.',
    affected_product: 'n8n workflow automation / MCP integrations',
    evidence_hash: row.evidenceHash,
    advisory_pdf_path: row.pdfPath,
    reporter_email:
      process.env.DISCLOSURE_REPORTER_EMAIL?.trim() ?? 'security@nexusshield.ai',
    source: 'nexus-shield-disclosure-portal',
    cwe_ids: ['CWE-20'],
  };
}

async function githubFetch<T>(
  token: string,
  endpoint: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await fetch(`${GITHUB_API}${endpoint}`, {
    ...init,
    headers: {
      ...GITHUB_HEADERS,
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    data = { message: text } as T;
  }

  return { ok: response.ok, status: response.status, data };
}

export async function checkGithubPrivateReporting(
  owner: string,
  repo: string,
  token?: string,
): Promise<{ enabled: boolean; error?: string }> {
  if (!token) {
    return { enabled: false, error: 'GITHUB_TOKEN or GH_PAT not configured' };
  }

  const result = await githubFetch<{ enabled?: boolean; message?: string }>(
    token,
    `/repos/${owner}/${repo}/private-vulnerability-reporting`,
  );

  if (!result.ok) {
    return {
      enabled: false,
      error:
        (result.data as { message?: string }).message ??
        `HTTP ${result.status} checking private vulnerability reporting`,
    };
  }

  return { enabled: Boolean(result.data.enabled) };
}

export async function submitGithubPrivateReport(input: {
  portalId: PortalTargetId;
  owner: string;
  repo: string;
  row: OutboundDisclosureRow;
  token?: string;
  dryRun?: boolean;
}): Promise<PortalSubmissionResult> {
  const portal =
    PORTAL_TARGETS.find((p) => p.id === input.portalId) ??
    PORTAL_TARGETS.find((p) => p.github?.owner === input.owner);
  const submissionUrl = `https://github.com/${input.owner}/${input.repo}/security/advisories/new`;
  const payload = buildGithubReportPayload(input.row);

  if (input.dryRun) {
    return {
      portalId: input.portalId,
      label: portal?.label ?? `${input.owner}/${input.repo}`,
      status: 'manual_required',
      method: 'github_api',
      submissionUrl,
      payloadLog: payload,
      error: 'Dry run — payload prepared but not submitted',
    };
  }

  if (!input.token) {
    return {
      portalId: input.portalId,
      label: portal?.label ?? `${input.owner}/${input.repo}`,
      status: 'manual_required',
      method: 'manual',
      submissionUrl,
      payloadLog: payload,
      error:
        'GITHUB_TOKEN or GH_PAT missing — grant public_repo (or repo) scope for private vulnerability reporting',
    };
  }

  const reporting = await checkGithubPrivateReporting(input.owner, input.repo, input.token);
  if (!reporting.enabled) {
    return {
      portalId: input.portalId,
      label: portal?.label ?? `${input.owner}/${input.repo}`,
      status: 'manual_required',
      method: 'manual',
      submissionUrl,
      payloadLog: payload,
      error:
        reporting.error ??
        'Private vulnerability reporting is not enabled on this repository',
    };
  }

  const result = await githubFetch<{ id?: number; html_url?: string; message?: string }>(
    input.token,
    `/repos/${input.owner}/${input.repo}/security-advisories/reports`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (!result.ok) {
    const message =
      (result.data as { message?: string }).message ?? `HTTP ${result.status}`;
    const needsManual =
      result.status === 403 ||
      result.status === 401 ||
      message.toLowerCase().includes('scope');

    return {
      portalId: input.portalId,
      label: portal?.label ?? `${input.owner}/${input.repo}`,
      status: needsManual ? 'manual_required' : 'failed',
      method: needsManual ? 'manual' : 'github_api',
      submissionUrl,
      httpStatus: result.status,
      payloadLog: payload,
      error: message,
    };
  }

  return {
    portalId: input.portalId,
    label: portal?.label ?? `${input.owner}/${input.repo}`,
    status: 'submitted',
    method: 'github_api',
    submissionUrl: result.data.html_url ?? submissionUrl,
    reportId: result.data.id ? String(result.data.id) : undefined,
    httpStatus: result.status,
    payloadLog: payload,
  };
}

export async function submitN8nVdp(input: {
  row: OutboundDisclosureRow;
  token?: string;
  dryRun?: boolean;
}): Promise<PortalSubmissionResult> {
  const portal = PORTAL_TARGETS.find((p) => p.id === 'n8n')!;
  const payload = buildN8nVdpPayload(input.row);
  const webhookUrl = process.env.N8N_VDP_WEBHOOK_URL?.trim();

  if (input.dryRun) {
    return {
      portalId: 'n8n',
      label: portal.label,
      status: 'manual_required',
      method: 'webhook',
      submissionUrl: portal.manualSubmissionUrl,
      payloadLog: payload,
      error: 'Dry run — payload prepared but not submitted',
    };
  }

  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = (await response.json().catch(() => ({}))) as { id?: string };
        return {
          portalId: 'n8n',
          label: portal.label,
          status: 'submitted',
          method: 'webhook',
          submissionUrl: portal.manualSubmissionUrl,
          reportId: data.id,
          httpStatus: response.status,
          payloadLog: payload,
        };
      }

      const errorText = await response.text();
      return {
        portalId: 'n8n',
        label: portal.label,
        status: 'failed',
        method: 'webhook',
        submissionUrl: portal.manualSubmissionUrl,
        httpStatus: response.status,
        payloadLog: payload,
        error: errorText || `Webhook HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        portalId: 'n8n',
        label: portal.label,
        status: 'failed',
        method: 'webhook',
        submissionUrl: portal.manualSubmissionUrl,
        payloadLog: payload,
        error: error instanceof Error ? error.message : 'Webhook request failed',
      };
    }
  }

  if (input.token && portal.github) {
    const githubResult = await submitGithubPrivateReport({
      portalId: 'n8n',
      owner: portal.github.owner,
      repo: portal.github.repo,
      row: input.row,
      token: input.token,
    });
    if (githubResult.status === 'submitted') {
      return githubResult;
    }
  }

  return {
    portalId: 'n8n',
    label: portal.label,
    status: 'manual_required',
    method: 'manual',
    submissionUrl: portal.manualSubmissionUrl,
    payloadLog: payload,
    error:
      'N8N_VDP_WEBHOOK_URL not configured — paste payload at n8n VDP form or set webhook URL in .env.local',
  };
}

export async function submitPortalDisclosure(input: {
  portalId: PortalTargetId;
  row: OutboundDisclosureRow;
  token?: string;
  dryRun?: boolean;
}): Promise<PortalSubmissionResult> {
  const portal = PORTAL_TARGETS.find((p) => p.id === input.portalId);
  if (!portal) {
    return {
      portalId: input.portalId,
      label: input.portalId,
      status: 'skipped',
      method: 'manual',
      submissionUrl: '',
      error: `Unknown portal target: ${input.portalId}`,
    };
  }

  if (input.portalId === 'activepieces' && portal.github) {
    return submitGithubPrivateReport({
      portalId: input.portalId,
      owner: portal.github.owner,
      repo: portal.github.repo,
      row: input.row,
      token: input.token,
      dryRun: input.dryRun,
    });
  }

  return submitN8nVdp({
    row: input.row,
    token: input.token,
    dryRun: input.dryRun,
  });
}

export function renderSubmissionTable(results: PortalSubmissionResult[]): string {
  const headers = ['Portal', 'Status', 'Method', 'Submission URL', 'Details'];
  const rows = results.map((r) => [
    r.label,
    r.status.toUpperCase(),
    r.method,
    r.submissionUrl,
    r.reportId
      ? `report=${r.reportId}`
      : r.error
        ? r.error.slice(0, 80)
        : '—',
  ]);

  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => (row[index] ?? '').length)),
  );

  const line = (cells: string[]) =>
    `| ${cells.map((cell, i) => (cell ?? '').padEnd(widths[i])).join(' | ')} |`;

  return [line(headers), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n');
}
