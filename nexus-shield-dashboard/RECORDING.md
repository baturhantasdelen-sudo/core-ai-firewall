# Nexus Shield — Growth Demo Recording

Automated **Attack → Prove → Install → Protect** screen recording via Playwright.

## Prerequisites

1. **Dashboard running locally**

```bash
cd nexus-shield-dashboard
npm install
npm run dev
# → http://localhost:3000
```

2. **Playwright Chromium** (first time only)

```bash
npm run record:browsers
```

3. **Optional — live playground block** (Step 2 evidence hash)

Point sandbox at a running Nexus API, or rely on the attack simulator animation if `/api/sandbox` is offline:

```bash
# .env.local (optional)
NEXUS_SHIELD_API_URL=https://api.nexusshield.ai
```

## Record

```bash
cd nexus-shield-dashboard
npm run record:demo
```

### Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `DEMO_BASE_URL` | `http://localhost:3000` | Dashboard URL |
| `DEMO_HEADLESS` | — | Set `1` for headless recording (video still captured) |
| `DEMO_OUTPUT_NAME` | `growth-demo.webm` | Output filename under `videos/` |

## Demo sequence

| Step | What it shows |
|------|----------------|
| **1 — Terminal** | `npm test` (58 Katman suites) + `test/scanner.test.ts` highlighted |
| **2 — Attack** | `#attack-simulator` Payment hijack → block → SHA-256 proof; playground LeetSpeak live block |
| **3 — Scan** | `/scan` MCP config → Agent Security Score, severity badges, SDK CTA |

Output: `videos/growth-demo.webm`

## Export for LinkedIn

Playwright records **WebM**. Convert with [ffmpeg](https://ffmpeg.org/):

**MP4 (recommended for LinkedIn feed)**

```bash
ffmpeg -i videos/growth-demo.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart videos/growth-demo.mp4
```

**GIF (short teaser)**

```bash
ffmpeg -i videos/growth-demo.webm -vf "fps=12,scale=720:-1:flags=lanczos" -loop 0 videos/growth-demo.gif
```

**Trim + compress for LinkedIn (≤10 min, ≤200 MB)**

```bash
ffmpeg -i videos/growth-demo.webm -ss 0 -t 90 -c:v libx264 -crf 23 -preset slow videos/growth-demo-linkedin.mp4
```

## Manual OBS / screen capture

Run the script with a visible browser (default) and record the desktop, or use:

```bash
DEMO_HEADLESS=0 npm run record:demo
```

For a polished cursor, the script injects a cyan highlight ring and step banners automatically.

## GCP / remote server

If Grafana uses port 3000, start the dashboard on **3001**:

```bash
NEXUS_DEMO_BYPASS_AUTH=1 npm run dev -- -p 3001 -H 127.0.0.1
DEMO_BASE_URL=http://127.0.0.1:3001 DEMO_HEADLESS=1 npm run record:demo
```
