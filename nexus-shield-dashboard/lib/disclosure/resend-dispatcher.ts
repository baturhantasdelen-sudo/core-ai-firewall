import { readFile } from 'fs/promises';
import path from 'path';
import { advisoryPdfFilename } from './disclosure-engine';
import { buildOutreachDrafts } from './outbound-matrix';
import type { DisclosureScanResult, OutboundDisclosureBatch } from './types';

export interface EmailDispatchResult {
  organizationName: string;
  intendedRecipient?: string;
  recipient: string;
  routedViaOverride: boolean;
  messageId?: string;
  status: 'sent' | 'skipped' | 'failed';
  error?: string;
}

interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string }>;
}

function parseSubject(emailDraft: string): string {
  const firstLine = emailDraft.split('\n')[0] ?? '';
  return firstLine.replace(/^Subject:\s*/i, '').trim();
}

function parseBody(emailDraft: string): string {
  const lines = emailDraft.split('\n');
  const bodyStart = lines.findIndex((line, index) => index > 0 && line.trim() === '');
  const body = bodyStart >= 0 ? lines.slice(bodyStart + 1).join('\n') : emailDraft;
  return body.trim();
}

const DEFAULT_FALLBACK_RECIPIENT = 'security@nexusshield.ai';

function resolveTargetContact(input: {
  outreachEmail?: string;
  cisoEmail?: string;
}): string | undefined {
  const outreach = input.outreachEmail?.trim();
  if (outreach) return outreach;
  const ciso = input.cisoEmail?.trim();
  return ciso || undefined;
}

/** 1) DISCLOSURE_OUTBOUND_RECIPIENT → 2) outreachEmail / cisoEmail → 3) security@nexusshield.ai */
function resolveRecipient(input: {
  outreachEmail?: string;
  cisoEmail?: string;
}): {
  recipient: string;
  intendedRecipient?: string;
  routedViaOverride: boolean;
} {
  const override = process.env.DISCLOSURE_OUTBOUND_RECIPIENT?.trim();
  const intended = resolveTargetContact(input);

  if (override) {
    return { recipient: override, intendedRecipient: intended, routedViaOverride: true };
  }
  if (intended) {
    return { recipient: intended, intendedRecipient: intended, routedViaOverride: false };
  }
  return {
    recipient: DEFAULT_FALLBACK_RECIPIENT,
    intendedRecipient: undefined,
    routedViaOverride: false,
  };
}

export async function sendDisclosureEmail(input: {
  result: DisclosureScanResult;
  pdfDiskPath: string;
  outreachEmail?: string;
  cisoEmail?: string;
}): Promise<EmailDispatchResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.OUTBOUND_FROM_EMAIL?.trim() ?? 'Nexus Shield Security <info@nexusshield.ai>';
  const routing = resolveRecipient({
    outreachEmail: input.outreachEmail,
    cisoEmail: input.cisoEmail,
  });
  const org = input.result.target.organizationName;

  if (!apiKey) {
    return {
      organizationName: org,
      intendedRecipient: routing.intendedRecipient,
      recipient: routing.recipient,
      routedViaOverride: routing.routedViaOverride,
      status: 'failed',
      error: 'RESEND_API_KEY is not configured',
    };
  }

  const drafts = buildOutreachDrafts(input.result);
  const subject = parseSubject(drafts.emailEn);
  const textBody = parseBody(drafts.emailEn);
  const pdfBuffer = await readFile(input.pdfDiskPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  const payload: ResendEmailPayload = {
    from,
    to: [routing.recipient],
    subject,
    html: [
      `<p>${textBody.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`,
      `<p style="color:#71717a;font-size:12px;">Evidence SHA-256: <code>${input.result.metrics.evidenceSha256Hash}</code></p>`,
      `<p style="color:#71717a;font-size:12px;">Confidential — Nexus Shield Responsible Disclosure Program</p>`,
    ].join(''),
    attachments: [
      {
        filename: advisoryPdfFilename(input.result.target.slug),
        content: pdfBase64,
      },
    ],
  };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as { id?: string; message?: string; name?: string };

    if (!response.ok) {
      return {
        organizationName: org,
        intendedRecipient: routing.intendedRecipient,
        recipient: routing.recipient,
        routedViaOverride: routing.routedViaOverride,
        status: 'failed',
        error: data.message ?? `${response.status} ${response.statusText}`,
      };
    }

    return {
      organizationName: org,
      intendedRecipient: routing.intendedRecipient,
      recipient: routing.recipient,
      routedViaOverride: routing.routedViaOverride,
      messageId: data.id,
      status: 'sent',
    };
  } catch (error) {
    return {
      organizationName: org,
      intendedRecipient: routing.intendedRecipient,
      recipient: routing.recipient,
      routedViaOverride: routing.routedViaOverride,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown Resend error',
    };
  }
}

export async function dispatchDisclosureBatchEmails(input: {
  batch: OutboundDisclosureBatch;
  scanResults: DisclosureScanResult[];
  pdfDir: string;
}): Promise<EmailDispatchResult[]> {
  const { batch, scanResults, pdfDir } = input;
  const dispatchResults: EmailDispatchResult[] = [];
  const override = process.env.DISCLOSURE_OUTBOUND_RECIPIENT?.trim();

  if (override) {
    console.log(
      `[disclosure:email] TEST MODE — DISCLOSURE_OUTBOUND_RECIPIENT=${override} (intended CISO emails preserved in log)`,
    );
  }

  for (const row of batch.results) {
    const scanResult = scanResults.find(
      (r) => r.target.organizationName === row.organizationName,
    );
    if (!scanResult) {
      const routing = resolveRecipient({
        outreachEmail: row.outreachEmail,
        cisoEmail: row.cisoEmail,
      });
      dispatchResults.push({
        organizationName: row.organizationName,
        intendedRecipient: routing.intendedRecipient,
        recipient: routing.recipient,
        routedViaOverride: routing.routedViaOverride,
        status: 'skipped',
        error: 'Scan result not found',
      });
      continue;
    }

    const pdfDiskPath = path.join(pdfDir, advisoryPdfFilename(scanResult.target.slug));
    const result = await sendDisclosureEmail({
      result: scanResult,
      pdfDiskPath,
      outreachEmail: scanResult.target.outreachEmail,
      cisoEmail: scanResult.target.cisoEmail,
    });
    dispatchResults.push(result);

    const icon = result.status === 'sent' ? '✓' : result.status === 'skipped' ? '○' : '✗';
    const intended =
      result.routedViaOverride && result.intendedRecipient
        ? ` (intended: ${result.intendedRecipient})`
        : '';
    console.log(
      `[disclosure:email] ${icon} ${row.organizationName} → ${result.recipient}${intended}${result.messageId ? ` (id=${result.messageId})` : ''}${result.error ? ` — ${result.error}` : ''}`,
    );
  }

  return dispatchResults;
}
