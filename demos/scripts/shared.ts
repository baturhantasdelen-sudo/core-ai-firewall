import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

export const VIDEOS_DIR = path.resolve(__dirname, '..', 'videos');

export interface DemoConfig {
  trustHubUrl: string;
  apiBaseUrl: string;
  loginEmail?: string;
  loginPassword?: string;
  headless: boolean;
}

export function loadConfig(): DemoConfig {
  return {
    trustHubUrl:
      process.env.TRUST_HUB_URL?.trim() ||
      'http://127.0.0.1:3000/dashboard/trust-hub',
    apiBaseUrl:
      process.env.API_BASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_API_URL?.trim() ||
      'https://api.nexusshield.ai',
    loginEmail: process.env.DEMO_LOGIN_EMAIL?.trim(),
    loginPassword: process.env.DEMO_LOGIN_PASSWORD?.trim(),
    headless: process.env.DEMO_HEADLESS === '1',
  };
}

export async function ensureVideosDir(): Promise<void> {
  await fs.promises.mkdir(VIDEOS_DIR, { recursive: true });
}

export async function createRecordingContext(
  outputName: string,
  config: DemoConfig,
): Promise<{ browser: Browser; context: BrowserContext; page: Page; videoPath: string }> {
  await ensureVideosDir();
  const videoPath = path.join(VIDEOS_DIR, outputName);

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
  return { browser, context, page, videoPath };
}

export async function finalizeVideo(
  page: Page,
  context: BrowserContext,
  browser: Browser,
  targetPath: string,
): Promise<string> {
  const rawVideo = page.video();
  const rawPath = rawVideo ? await rawVideo.path() : null;
  await context.close();
  await browser.close();

  if (!rawPath) {
    throw new Error('No Playwright video attachment found on page');
  }

  await fs.promises.rename(rawPath, targetPath);
  return targetPath;
}

export async function loginIfNeeded(page: Page, config: DemoConfig): Promise<void> {
  await page.goto(config.trustHubUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  if (!page.url().includes('/login')) {
    return;
  }

  if (!config.loginEmail || !config.loginPassword) {
    throw new Error(
      'Trust Hub redirected to /login. Set DEMO_LOGIN_EMAIL and DEMO_LOGIN_PASSWORD, ' +
        'or run the dashboard with NEXUS_DEMO_BYPASS_AUTH=1 for local recording.',
    );
  }

  await page.getByLabel(/email/i).fill(config.loginEmail);
  await page.getByLabel(/password/i).fill(config.loginPassword);
  await page.getByRole('button', { name: /sign in|log in|continue/i }).click();
  await page.waitForURL(/\/dashboard\/trust-hub/, { timeout: 60_000 });
}

export async function waitForTrustHub(page: Page): Promise<void> {
  await page.getByRole('heading', { name: /Agent Trust.*Prove Hub|Trust Hub/i }).first().waitFor({
    timeout: 60_000,
  });
}

export async function highlightElement(page: Page, selector: string): Promise<void> {
  await page.locator(selector).evaluate((element) => {
    element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    element.classList.add('nexus-demo-highlight');
    (element as HTMLElement).style.outline = '3px solid #22d3ee';
    (element as HTMLElement).style.outlineOffset = '4px';
    (element as HTMLElement).style.boxShadow = '0 0 24px rgba(34, 211, 238, 0.45)';
  });
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
