#!/usr/bin/env tsx
/**
 * Demo 1 — Proof Center performance & attack resilience recording.
 * Output: demos/videos/demo1_performance.webm
 */
import path from 'node:path';
import {
  createRecordingContext,
  finalizeVideo,
  highlightElement,
  loadConfig,
  loginIfNeeded,
  sleep,
  waitForTrustHub,
} from './shared.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const output = path.join(path.resolve(__dirname, '..', 'videos'), 'demo1_performance.webm');
  const { browser, context, page, videoPath } = await createRecordingContext('demo1_performance.webm', config);

  try {
    await loginIfNeeded(page, config);
    await waitForTrustHub(page);
    await sleep(1200);

    const proofCenter = page.getByRole('heading', { name: /Nexus Shield Proof Center/i });
    await proofCenter.scrollIntoViewIfNeeded();
    await sleep(800);

    await highlightElement(page, '[data-demo="proof-latency-card"]');
    await sleep(1500);
    await highlightElement(page, '[data-demo="proof-attack-card"]');
    await sleep(1500);

    const runButton = page.getByRole('button', { name: /Run Live Benchmark Test/i });
    await runButton.scrollIntoViewIfNeeded();
    await runButton.click();

    await page.getByText(/Source: live/i).waitFor({ timeout: 180_000 });
    await page.getByText(/P99 runtime intercept|6\.1ms|Agent Action Governance/i).waitFor({ timeout: 30_000 });
    await page.getByText(/100\.0% Blocked|50\/50/i).first().waitFor({ timeout: 30_000 });

    await highlightElement(page, '[data-demo="proof-latency-card"]');
    await sleep(2000);
    await highlightElement(page, '[data-demo="proof-attack-card"]');
    await sleep(2500);

    console.log(`[demo1] Recording complete → ${videoPath}`);
  } finally {
    const saved = await finalizeVideo(page, context, browser, output);
    console.log(`[demo1] Saved ${saved}`);
  }
}

main().catch((error) => {
  console.error('[demo1] Failed:', error);
  process.exit(1);
});
