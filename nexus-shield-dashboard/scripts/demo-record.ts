#!/usr/bin/env tsx
/**
 * Growth funnel screen recording — Attack → Prove → Install → Protect
 *
 * Prerequisites:
 *   npm run dev   (http://localhost:3000)
 *
 * Output:
 *   videos/growth-demo.webm  (Playwright native WebM — convert to MP4/GIF for LinkedIn)
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import {
  VIDEOS_DIR,
  captureTestRun,
  clearHighlights,
  clickWithCursor,
  ensureVideosDir,
  highlightLocator,
  hideStepBanner,
  injectDemoChrome,
  loadDemoConfig,
  moveCursorToLocator,
  showStepBanner,
  sleep,
  writeTerminalHtml,
} from './demo-recording-utils';

const DASHBOARD_ROOT = path.resolve(__dirname, '..');

async function main(): Promise<void> {
  const config = loadDemoConfig();
  await ensureVideosDir();

  console.log('[record:demo] Capturing npm test output…');
  const testOutput = captureTestRun(DASHBOARD_ROOT);
  const terminalHtml = await writeTerminalHtml(testOutput);
  const terminalUrl = pathToFileURL(terminalHtml).href;

  const outputPath = path.join(VIDEOS_DIR, config.outputName);

  console.log(`[record:demo] Recording → ${outputPath}`);
  console.log(`[record:demo] Dashboard: ${config.baseUrl}`);

  const browser = await chromium.launch({
    headless: config.headless,
    args: ['--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: VIDEOS_DIR,
      size: { width: 1440, height: 900 },
    },
  });

  const page = await context.newPage();
  await injectDemoChrome(page);

  try {
    // ── Step 1: Terminal test run ─────────────────────────────────────────────
    await showStepBanner(page, 'Step 1 — npm test · 58/58 Katman + scanner');
    await page.goto(terminalUrl, { waitUntil: 'domcontentloaded' });
    await sleep(1200);
    await page.locator('mark.hl-scanner').first().scrollIntoViewIfNeeded();
    await highlightLocator(page, page.locator('mark.hl-scanner').first());
    await sleep(2500);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    await sleep(2000);
    await clearHighlights(page);
    await hideStepBanner(page);

    // ── Step 2: Attack simulator + live playground block ──────────────────────
    await showStepBanner(page, 'Step 2 — Attack → Detect → Block → Proof');
    await page.goto(`${config.baseUrl}/#attack-simulator`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await sleep(1000);

    const simulator = page.locator('#attack-simulator');
    await simulator.scrollIntoViewIfNeeded();
    await highlightLocator(page, simulator);
    await sleep(1200);

    const paymentHijack = page.getByRole('button', { name: /Payment hijack/i });
    await clickWithCursor(page, paymentHijack);
    await sleep(500);

    const attackBtn = page.getByRole('button', { name: /^ATTACK MY AGENT$/i });
    await clickWithCursor(page, attackBtn);
    await sleep(3800);

    const evidenceStep = page.locator('[data-demo="attack-evidence-step"]');
    await highlightLocator(page, evidenceStep);
    await sleep(2000);
    await clearHighlights(page);

    await page.goto(`${config.baseUrl}/#playground`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await sleep(800);

    const leetPreset = page.getByRole('button', { name: /LeetSpeak Injection/i });
    await clickWithCursor(page, leetPreset);
    await sleep(3500);

    const playgroundOutput = page.locator('[data-demo="playground-output"]');
    await highlightLocator(page, playgroundOutput);

    const blockLine = page.getByText(/ATTACK DETECTED.*BLOCKED BY NEXUS SHIELD/i).first();
    if (await blockLine.isVisible({ timeout: 8000 }).catch(() => false)) {
      await highlightLocator(page, blockLine);
    }
    const evidenceHash = page.getByText(/evidence_hash=sha256:/i).first();
    if (await evidenceHash.isVisible({ timeout: 3000 }).catch(() => false)) {
      await highlightLocator(page, evidenceHash);
    }
    await sleep(2500);
    await clearHighlights(page);
    await hideStepBanner(page);

    // ── Step 3: Free security scanner ───────────────────────────────────────
    await showStepBanner(page, 'Step 3 — Free Agent Security Scan');
    await page.goto(`${config.baseUrl}/scan`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await sleep(1000);

    const mcpTab = page.getByRole('button', { name: /MCP Config JSON/i });
    await clickWithCursor(page, mcpTab);
    await sleep(400);

    const loadExample = page.getByRole('button', { name: /Load example/i });
    await clickWithCursor(page, loadExample);
    await sleep(600);

    const runScan = page.locator('[data-demo="scan-run-btn"]');
    await clickWithCursor(page, runScan);

    const scoreBlock = page.locator('[data-demo="scan-score"]');
    await scoreBlock.waitFor({ state: 'visible', timeout: 30_000 });
    await sleep(800);
    await highlightLocator(page, scoreBlock);
    await sleep(1500);

    const criticalBadge = page.getByText(/^critical:/i).first();
    if (await criticalBadge.isVisible().catch(() => false)) {
      await highlightLocator(page, criticalBadge);
      await sleep(800);
    }
    const highBadge = page.getByText(/^high:/i).first();
    if (await highBadge.isVisible().catch(() => false)) {
      await highlightLocator(page, highBadge);
      await sleep(800);
    }

    const sdkCta = page.locator('[data-demo="scan-sdk-cta"]');
    await moveCursorToLocator(page, sdkCta);
    await highlightLocator(page, sdkCta);
    await sleep(2500);

    await hideStepBanner(page);
    console.log('[record:demo] Sequence complete — finalizing video…');
  } finally {
    const rawVideo = page.video();
    const rawPath = rawVideo ? await rawVideo.path() : null;
    await context.close();
    await browser.close();

    if (!rawPath) {
      throw new Error('No Playwright video attachment found');
    }

    const fs = await import('node:fs/promises');
    await fs.rename(rawPath, outputPath);
    console.log(`[record:demo] Saved ${outputPath}`);
    console.log('[record:demo] Convert for LinkedIn:');
    console.log(`  ffmpeg -i "${outputPath}" -c:v libx264 -pix_fmt yuv420p videos/growth-demo.mp4`);
    console.log(`  ffmpeg -i "${outputPath}" -vf "fps=12,scale=720:-1" videos/growth-demo.gif`);
  }
}

main().catch((error) => {
  console.error('[record:demo] Failed:', error);
  process.exit(1);
});
