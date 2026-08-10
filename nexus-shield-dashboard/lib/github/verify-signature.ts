import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies the `x-hub-signature-256` header GitHub sends with every webhook
 * delivery. Must be run against the raw (unparsed) request body — GitHub
 * signs the exact bytes it sent, so re-serializing parsed JSON would not
 * reliably match.
 */
export function verifyGithubSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;

  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const actualBuffer = Buffer.from(signatureHeader, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
