import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Locator, Page } from 'playwright';

export const VIDEOS_DIR = path.resolve(__dirname, '..', 'videos');
export const TERMINAL_HTML = path.resolve(__dirname, '.demo-terminal.html');

export interface DemoRecordConfig {
  baseUrl: string;
  headless: boolean;
  outputName: string;
}

export function loadDemoConfig(): DemoRecordConfig {
  return {
    baseUrl: (process.env.DEMO_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    headless: process.env.DEMO_HEADLESS === '1',
    outputName: process.env.DEMO_OUTPUT_NAME?.trim() || 'growth-demo.webm',
  };
}

export async function ensureVideosDir(): Promise<void> {
  await fs.promises.mkdir(VIDEOS_DIR, { recursive: true });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function captureTestRun(dashboardRoot: string): string {
  const chunks: string[] = [];
  const run = (label: string, command: string) => {
    chunks.push(`\n$ ${label}\n`);
    try {
      const out = execSync(command, {
        cwd: dashboardRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' },
      });
      chunks.push(out);
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      chunks.push(err.stdout ?? '');
      chunks.push(err.stderr ?? '');
      chunks.push(`\n[exit] ${err.message ?? 'test command failed'}\n`);
    }
  };

  run('npm test', 'npm test');
  run('npx tsx --test test/scanner.test.ts', 'npx tsx --test test/scanner.test.ts');
  return chunks.join('\n');
}

export async function writeTerminalHtml(rawOutput: string): Promise<string> {
  const escaped = rawOutput
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const highlighted = escaped
    .replace(/(test\/scanner\.test\.ts)/g, '<mark class="hl-scanner">$1</mark>')
    .replace(/(✔|pass \d+)/g, '<span class="hl-pass">$1</span>')
    .replace(/(ℹ tests 58|58\/58|tests 58)/gi, '<span class="hl-total">$1</span>')
    .replace(/(runAgentSecurityScan)/g, '<mark class="hl-scanner">$1</mark>');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Nexus Shield — Test Run</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: #0a0a0b;
      color: #e4e4e7;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
      line-height: 1.55;
    }
    header {
      padding: 20px 28px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      background: linear-gradient(90deg, rgba(16,185,129,0.12), rgba(6,182,212,0.08));
    }
    header h1 { margin: 0; font-size: 18px; font-weight: 600; color: #6ee7b7; }
    header p { margin: 6px 0 0; color: #71717a; font-size: 12px; }
    pre {
      margin: 0;
      padding: 24px 28px 40px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .hl-scanner { background: rgba(251,191,36,0.25); color: #fde68a; padding: 0 2px; border-radius: 2px; }
    .hl-pass { color: #34d399; font-weight: 600; }
    .hl-total { color: #22d3ee; font-weight: 700; }
  </style>
</head>
<body>
  <header>
    <h1>Step 1 — npm test · Katman suites + scanner.test.ts</h1>
    <p>Attack → Prove → Install → Protect · Nexus Shield growth demo</p>
  </header>
  <pre>${highlighted}</pre>
</body>
</html>`;

  await fs.promises.writeFile(TERMINAL_HTML, html, 'utf8');
  return TERMINAL_HTML;
}

export async function injectDemoChrome(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (document.getElementById('nexus-demo-cursor')) return;

    const style = document.createElement('style');
    style.textContent = `
      #nexus-demo-cursor {
        position: fixed;
        width: 18px;
        height: 18px;
        border: 2px solid #22d3ee;
        border-radius: 50%;
        background: rgba(34, 211, 238, 0.35);
        pointer-events: none;
        z-index: 99999;
        transform: translate(-50%, -50%);
        transition: left 0.45s ease, top 0.45s ease;
        box-shadow: 0 0 16px rgba(34, 211, 238, 0.55);
      }
      #nexus-demo-banner {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99998;
        padding: 10px 18px;
        border-radius: 999px;
        border: 1px solid rgba(34, 211, 238, 0.35);
        background: rgba(9, 9, 11, 0.92);
        color: #a5f3fc;
        font: 600 12px/1.2 ui-sans-serif, system-ui, sans-serif;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        backdrop-filter: blur(8px);
        pointer-events: none;
      }
      .nexus-demo-highlight {
        outline: 3px solid #22d3ee !important;
        outline-offset: 4px !important;
        box-shadow: 0 0 28px rgba(34, 211, 238, 0.45) !important;
      }
    `;
    document.head.appendChild(style);

    const cursor = document.createElement('div');
    cursor.id = 'nexus-demo-cursor';
    document.body.appendChild(cursor);

    const banner = document.createElement('div');
    banner.id = 'nexus-demo-banner';
    banner.hidden = true;
    document.body.appendChild(banner);
  });
}

export async function showStepBanner(page: Page, text: string): Promise<void> {
  await page.evaluate((label) => {
    const banner = document.getElementById('nexus-demo-banner');
    if (banner) {
      banner.textContent = label;
      banner.hidden = false;
    }
  }, text);
}

export async function hideStepBanner(page: Page): Promise<void> {
  await page.evaluate(() => {
    const banner = document.getElementById('nexus-demo-banner');
    if (banner) banner.hidden = true;
  });
}

export async function moveCursorToLocator(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) return;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.evaluate(
    ({ px, py }) => {
      const cursor = document.getElementById('nexus-demo-cursor');
      if (cursor) {
        cursor.style.left = `${px}px`;
        cursor.style.top = `${py}px`;
      }
    },
    { px: x, py: y },
  );
  await sleep(450);
}

export async function highlightLocator(page: Page, locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((element) => {
    element.classList.add('nexus-demo-highlight');
  });
}

export async function clearHighlights(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('.nexus-demo-highlight').forEach((el) => {
      el.classList.remove('nexus-demo-highlight');
    });
  });
}

export async function clickWithCursor(page: Page, locator: Locator): Promise<void> {
  await moveCursorToLocator(page, locator);
  await locator.click();
}
