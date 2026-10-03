#!/usr/bin/env tsx
/**
 * Nexus Shield v2.0 — Automated accountability demo recording.
 *
 * Spins up FastAPI accountability API + Next.js, records live audit terminal output +
 * Proof Center UI via Playwright, and renders outputs/nexus_shield_demo.mp4.
 *
 * Prerequisites:
 *   - nexus-shield-dashboard: npm install && npx playwright install chromium
 *   - ffmpeg on PATH
 *   - pip install -e ".[dev,proxy]" (repo root)
 *
 * Usage (from repository root):
 *   cd nexus-shield-dashboard && npx tsx ../scripts/generate_demo_recording.ts
 */

import { execFileSync, execSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const REPO_ROOT = path.resolve(__dirname, '..');
const DASHBOARD_ROOT = path.join(REPO_ROOT, 'nexus-shield-dashboard');
const requireFromDashboard = createRequire(path.join(DASHBOARD_ROOT, 'package.json'));
const { chromium } = requireFromDashboard('playwright') as typeof import('playwright');
type Page = import('playwright').Page;
const OUTPUT_DIR = path.join(REPO_ROOT, 'outputs');
const OUTPUT_MP4 = path.join(OUTPUT_DIR, 'nexus_shield_demo.mp4');
const TEMP_WEBM = path.join(OUTPUT_DIR, '.nexus_shield_demo_raw.webm');
const TERMINAL_HTML = path.join(OUTPUT_DIR, '.audit_terminal.html');
const BASE_URL = (process.env.DEMO_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const ACCOUNTABILITY_PORT = Number(process.env.DEMO_ACCOUNTABILITY_PORT ?? '8099');
const ACCOUNTABILITY_URL = (
  process.env.DEMO_ACCOUNTABILITY_URL ?? `http://127.0.0.1:${ACCOUNTABILITY_PORT}`
).replace(/\/$/, '');
const VIEWPORT = { width: 1440, height: 900 };
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';
const PYTHONPATH = [REPO_ROOT, path.join(REPO_ROOT, 'packages', 'python')].join(
  process.platform === 'win32' ? ';' : ':',
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureFfmpeg(): void {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
  } catch {
    throw new Error('ffmpeg is required on PATH to render MP4 output');
  }
}

async function waitForHttp(url: string, timeoutMs = 120_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok || res.status < 500) return;
    } catch {
      /* retry */
    }
    await sleep(1500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startNextDevServer(): ChildProcessWithoutNullStreams {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCmd, ['run', 'dev'], {
    cwd: DASHBOARD_ROOT,
    env: {
      ...process.env,
      PORT: '3000',
      HOSTNAME: '127.0.0.1',
      NEXUS_SHIELD_API_URL: ACCOUNTABILITY_URL,
    },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
  child.stdout?.on('data', (chunk) => process.stdout.write(`[next] ${chunk}`));
  child.stderr?.on('data', (chunk) => process.stderr.write(`[next] ${chunk}`));
  return child;
}

function startAccountabilityApiServer(): ChildProcessWithoutNullStreams {
  const child = spawn(
    PYTHON,
    [
      '-m',
      'uvicorn',
      'accountability_demo_server:app',
      '--host',
      '127.0.0.1',
      '--port',
      String(ACCOUNTABILITY_PORT),
      '--log-level',
      'warning',
    ],
    {
      cwd: path.join(REPO_ROOT, 'scripts'),
      env: { ...process.env, PYTHONPATH },
      stdio: 'pipe',
      shell: process.platform === 'win32',
    },
  );
  child.stdout?.on('data', (chunk) => process.stdout.write(`[api] ${chunk}`));
  child.stderr?.on('data', (chunk) => process.stderr.write(`[api] ${chunk}`));
  return child;
}

function stopProcessTree(child: ChildProcessWithoutNullStreams | null): void {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /PID ${child.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      child.kill('SIGTERM');
    }
  } else {
    child.kill('SIGTERM');
  }
}

function highlightAuditOutput(rawOutput: string): string {
  const escaped = rawOutput
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .replace(/(Profile A|Compliant Enterprise Agent)/g, '<mark class="hl-a">$1</mark>')
    .replace(/(Profile B|False-Success Rogue Agent|UNVERIFIED)/g, '<mark class="hl-b">$1</mark>')
    .replace(/(Profile C|Privilege Escalation|403)/g, '<mark class="hl-c">$1</mark>')
    .replace(/(\bPASS\b)/g, '<span class="ok">PASS</span>')
    .replace(/(\bFAIL\b)/g, '<span class="bad">FAIL</span>')
    .replace(/(Detection rate: 100%|AUDIT PASSED)/g, '<span class="ok-strong">$1</span>');
}

function auditTerminalDocumentHtml(highlightedBody: string, statusLine: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Nexus Shield Audit</title>
  <style>
    body { margin: 0; background: #09090b; color: #e4e4e7; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.5; }
    header { padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); background: linear-gradient(90deg, rgba(16,185,129,0.15), rgba(6,182,212,0.1)); }
    header h1 { margin: 0; color: #6ee7b7; font-size: 17px; }
    header p { margin: 6px 0 0; color: #71717a; font-size: 12px; }
    pre { margin: 0; padding: 20px 24px 48px; white-space: pre-wrap; word-break: break-word; }
    .ok { color: #34d399; font-weight: 700; }
    .ok-strong { color: #22d3ee; font-weight: 800; }
    .bad { color: #f87171; font-weight: 700; }
    mark.hl-a { background: rgba(52,211,153,0.2); color: #a7f3d0; }
    mark.hl-b { background: rgba(251,191,36,0.2); color: #fde68a; }
    mark.hl-c { background: rgba(248,113,113,0.2); color: #fecaca; }
  </style>
</head>
<body>
  <header>
    <h1>python scripts/run_comprehensive_audit.py</h1>
    <p>${statusLine}</p>
  </header>
  <pre id="audit-output">${highlightedBody}</pre>
</body>
</html>`;
}

async function writeAuditTerminalHtml(rawOutput: string): Promise<string> {
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  const html = auditTerminalDocumentHtml(
    highlightAuditOutput(rawOutput),
    'Profiles A (Compliant) · B (False Success) · C (Privilege Escalation)',
  );
  await fs.promises.writeFile(TERMINAL_HTML, html, 'utf8');
  return TERMINAL_HTML;
}

function spawnComprehensiveAudit(): {
  proc: ChildProcessWithoutNullStreams;
  output: () => string;
  done: Promise<{ code: number | null; output: string }>;
} {
  let buffer = '';
  const proc = spawn(PYTHON, [path.join(REPO_ROOT, 'scripts', 'run_comprehensive_audit.py')], {
    cwd: REPO_ROOT,
    env: { ...process.env, PYTHONPATH },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  proc.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
  });

  const done = new Promise<{ code: number | null; output: string }>((resolve) => {
    proc.on('close', (code) => resolve({ code, output: buffer }));
  });

  return { proc, output: () => buffer, done };
}

async function recordLiveAuditTerminal(page: Page): Promise<string> {
  await page.setContent(
    auditTerminalDocumentHtml(
      '<span class="ok-strong">▶ Running comprehensive audit harness…</span>',
      'Live execution — Profiles A · B · C',
    ),
    { waitUntil: 'domcontentloaded' },
  );

  const { output, done } = spawnComprehensiveAudit();
  let lastLen = 0;

  while (true) {
    const pending = done;
    const race = await Promise.race([
      pending,
      sleep(450).then(() => null as const),
    ]);

    const text = output();
    if (text.length !== lastLen) {
      lastLen = text.length;
      await page.evaluate((html) => {
        const el = document.getElementById('audit-output');
        if (el) el.innerHTML = html;
      }, highlightAuditOutput(text || '…'));
      await page.evaluate(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      });
    }

    if (race !== null) {
      const { code, output: finalOut } = race;
      await page.evaluate((html) => {
        const el = document.getElementById('audit-output');
        if (el) el.innerHTML = html;
      }, highlightAuditOutput(finalOut));
      if (code !== 0 || !finalOut.includes('AUDIT PASSED')) {
        throw new Error(
          `Comprehensive audit failed (exit ${code ?? 'unknown'}) — fix accountability stack before recording`,
        );
      }
      await sleep(2200);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await sleep(1200);
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
      await sleep(2800);
      await writeAuditTerminalHtml(finalOut);
      return finalOut;
    }
  }
}

async function injectDemoChrome(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (document.getElementById('nexus-demo-cursor')) return;
    const style = document.createElement('style');
    style.textContent = `
      #nexus-demo-cursor { position: fixed; width: 18px; height: 18px; border: 2px solid #22d3ee; border-radius: 50%;
        background: rgba(34,211,238,0.35); pointer-events: none; z-index: 99999; transform: translate(-50%,-50%);
        transition: left 0.4s ease, top 0.4s ease; box-shadow: 0 0 16px rgba(34,211,238,0.55); }
      #nexus-demo-banner { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 99998;
        padding: 8px 16px; border-radius: 999px; border: 1px solid rgba(34,211,238,0.35); background: rgba(9,9,11,0.92);
        color: #a5f3fc; font: 600 11px/1.2 ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; }
      .nexus-demo-highlight { outline: 3px solid #22d3ee !important; outline-offset: 3px !important; }
    `;
    document.head.appendChild(style);
    const cursor = document.createElement('div');
    cursor.id = 'nexus-demo-cursor';
    document.body.appendChild(cursor);
    const banner = document.createElement('div');
    banner.id = 'nexus-demo-banner';
    document.body.appendChild(banner);
  });
}

async function showBanner(page: Page, text: string): Promise<void> {
  await page.evaluate((label) => {
    const banner = document.getElementById('nexus-demo-banner');
    if (banner) banner.textContent = label;
  }, text);
}

async function recordProofCenterScene(page: Page): Promise<void> {
  await showBanner(page, 'Proof Center — Action Verification');
  await page.goto(`${BASE_URL}/proof-center#action-verification-center`, {
    waitUntil: 'domcontentloaded',
    timeout: 90_000,
  });
  await sleep(2000);

  const receiptSection = page.getByRole('heading', { name: /AAR 2.0 Receipt Inspector/i });
  await receiptSection.scrollIntoViewIfNeeded().catch(() => undefined);
  await sleep(800);

  const unverifiedBtn = page.getByRole('button', { name: /UNVERIFIED \/ False Success/i }).first();
  if (await unverifiedBtn.isVisible().catch(() => false)) {
    await unverifiedBtn.click();
    await sleep(1800);
  }

  const verifiedBtn = page.getByRole('button', { name: /^VERIFIED$/i }).first();
  if (await verifiedBtn.isVisible().catch(() => false)) {
    await verifiedBtn.click();
    await sleep(1800);
  }

  const copyHash = page.getByRole('button', { name: /Copy evidence_hash/i }).first();
  if (await copyHash.isVisible().catch(() => false)) {
    await copyHash.click();
    await sleep(1200);
  }

  const blastHeading = page.getByRole('heading', { name: /Blast Radius/i });
  await blastHeading.scrollIntoViewIfNeeded().catch(() => undefined);
  await sleep(800);

  const removeTool = page.getByRole('button', { name: /Remove stripe_create_transfer/i }).first();
  if (await removeTool.isVisible().catch(() => false)) {
    await removeTool.click();
    await sleep(2200);
    const baseline = page.getByRole('button', { name: /^Baseline$/i }).first();
    if (await baseline.isVisible().catch(() => false)) await baseline.click();
    await sleep(1200);
  }

  const delegationHeading = page.getByRole('heading', { name: /Delegation Hierarchy/i });
  await delegationHeading.scrollIntoViewIfNeeded().catch(() => undefined);
  await sleep(1000);

  const blocked = page.getByText(/Blocked escalation/i).first();
  if (await blocked.isVisible().catch(() => false)) {
    await blocked.scrollIntoViewIfNeeded();
    await sleep(2200);
  }

  const auditTrail = page.getByText(/^Audit trail$/i).first();
  if (await auditTrail.isVisible().catch(() => false)) {
    await auditTrail.scrollIntoViewIfNeeded();
    await sleep(2500);
  }

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(1500);
}

function webmToMp4(webmPath: string, mp4Path: string): void {
  execFileSync(
    'ffmpeg',
    ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path],
    { stdio: 'inherit' },
  );
}

async function main(): Promise<void> {
  ensureFfmpeg();
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });

  console.log('[demo-recording] Starting accountability API (FastAPI / uvicorn)…');
  const apiServer = startAccountabilityApiServer();
  console.log('[demo-recording] Starting Next.js dev server…');
  const devServer = startNextDevServer();

  try {
    await waitForHttp(`${ACCOUNTABILITY_URL}/v1/accountability/receipts`);
    await waitForHttp(`${BASE_URL}/proof-center`);

    console.log('[demo-recording] Recording Playwright session…');
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      viewport: VIEWPORT,
      recordVideo: { dir: OUTPUT_DIR, size: VIEWPORT },
    });

    const page = await context.newPage();
    await injectDemoChrome(page);

    await showBanner(page, 'Terminal — Comprehensive Audit');
    await recordLiveAuditTerminal(page);

    await recordProofCenterScene(page);

    const video = page.video();
    const rawWebm = video ? await video.path() : null;
    await context.close();
    await browser.close();

    if (!rawWebm) throw new Error('Playwright did not produce a video file');

    await fs.promises.rename(rawWebm, TEMP_WEBM);
    console.log('[demo-recording] Transcoding WebM → MP4 via ffmpeg…');
    webmToMp4(TEMP_WEBM, OUTPUT_MP4);
    await fs.promises.unlink(TEMP_WEBM).catch(() => undefined);

    console.log(`\n✅ Nexus Shield demo video saved: ${OUTPUT_MP4}\n`);
  } finally {
    stopProcessTree(devServer);
    stopProcessTree(apiServer);
  }
}

main().catch((error) => {
  console.error('[demo-recording] Failed:', error);
  process.exit(1);
});
