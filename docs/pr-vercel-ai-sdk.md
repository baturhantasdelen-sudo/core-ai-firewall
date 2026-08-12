# Pull request: vercel/ai — Nexus Shield Edge guardrails guide

Use this document to open a documentation PR against [vercel/ai](https://github.com/vercel/ai).

---

## PR title

```
docs(guides): add @baturhantasdelen/nexus-shield-edge to AI SDK guardrails guide
```

## PR description

```markdown
## Summary

- Adds a guardrails guide for [@baturhantasdelen/nexus-shield-edge](https://www.npmjs.com/package/@baturhantasdelen/nexus-shield-edge), an edge-native, zero-dependency PII masking library for the Vercel AI SDK and Edge Runtime.
- Documents input sanitization on Vercel Edge (`export const runtime = 'edge'`) and Cloudflare Workers middleware integration.
- Highlights sub-millisecond, in-memory execution with no network roundtrip to an external guardrail service.

## Motivation

The AI SDK already documents [language model middleware](/docs/ai-sdk-core/middleware) for output-side guardrails. Many production apps also need **input-side PII redaction** before prompts reach an LLM. Remote guardrail APIs add latency and fail when the network is slow or unavailable.

`@baturhantasdelen/nexus-shield-edge` runs compiled regex patterns directly in the Edge Runtime or Cloudflare Workers isolate, typically in **< 0.1 ms**, with zero npm dependencies beyond TypeScript types at build time.

## Changes

| File | Action |
| :--- | :--- |
| `content/docs/06-advanced/12-guardrails.mdx` | **Add** — new guide (recommended path, see note below) |
| `content/docs/03-ai-sdk-core/40-middleware.mdx` | **Optional** — add one bullet under "Community Middleware" linking to the new guide |

## Recommended file path

The upstream repo does **not** contain `content/docs/07-guides/`. Guardrails fit naturally in **Advanced** alongside [Rate Limiting](/docs/advanced/rate-limiting) and [Secure URL Fetching](/docs/advanced/secure-url-fetching):

```
content/docs/06-advanced/12-guardrails.mdx
```

If maintainers prefer the cookbook layout instead, place the same MDX at:

```
content/cookbook/00-guides/24-guardrails.mdx
```

## Test plan

- [ ] `pnpm build` in `apps/docs` succeeds
- [ ] New page renders at `/docs/advanced/guardrails`
- [ ] Code samples use TypeScript and match existing MDX conventions (`__PROVIDER_IMPORT__`, `__MODEL__`)
- [ ] Links to npm package and middleware doc resolve correctly

## Package

- npm: https://www.npmjs.com/package/@baturhantasdelen/nexus-shield-edge
- Source: https://github.com/baturhantasdelen-sudo/core-ai-firewall/tree/main/packages/edge
```

---

## File to add: `content/docs/06-advanced/12-guardrails.mdx`

Copy the MDX block below verbatim into the upstream repo.

````mdx
---
title: Edge-native guardrails
description: Redact PII in user prompts at the edge before they reach an LLM, with sub-millisecond latency and no network roundtrip.
---

# Edge-native guardrails

Guardrails keep sensitive data out of LLM prompts and responses. Remote guardrail APIs add a network hop on every request, which increases latency and creates a dependency you cannot control at the edge.

[@baturhantasdelen/nexus-shield-edge](https://www.npmjs.com/package/@baturhantasdelen/nexus-shield-edge) runs in-memory pattern matching inside the [Vercel Edge Runtime](https://vercel.com/docs/functions/runtimes/edge) or [Cloudflare Workers](https://developers.cloudflare.com/workers/). It redacts common PII types—emails, phone numbers, credit cards, national IDs, and leaked API keys—in **< 0.1 ms** with zero runtime dependencies.

Use it to sanitize **inputs** before you call `generateText`, `streamText`, or an upstream provider. For **output-side** filtering after the model responds, combine it with [Language Model Middleware](/docs/ai-sdk-core/middleware).

## Overview

Edge-native guardrails matter when you deploy AI routes close to users:

- **Zero network roundtrip** — patterns compile once and run in the same isolate as your route handler.
- **Sub-millisecond execution** — typical sanitization completes in < 0.1 ms on warm edge instances.
- **No external service** — guardrails keep working when a third-party API is slow or unavailable.
- **TypeScript-first** — import `createNexusShield`, call `sanitize()`, pass the clean string to the AI SDK.

Nexus Shield complements—not replaces—the guardrail patterns in [Language Model Middleware](/docs/ai-sdk-core/middleware). Sanitize user input at the edge first, then optionally wrap your model with middleware to filter model output.

## Installation

Install the package in your Next.js, Vercel, or Cloudflare Workers project:

```bash
npm install @baturhantasdelen/nexus-shield-edge
```

## Vercel AI SDK integration (Edge route)

Create an Edge route handler that sanitizes the prompt before you call the AI SDK. Set `runtime` to `'edge'` so the library runs on Vercel's Edge Runtime.

```tsx filename='app/api/chat/route.ts'
import { createNexusShield } from '@baturhantasdelen/nexus-shield-edge';
import { generateText } from 'ai';
__PROVIDER_IMPORT__;

export const runtime = 'edge';

const shield = createNexusShield({
  maskTCKN: true,
  maskCreditCard: true,
  maskEmail: true,
  maskPhone: true,
  maskAPIKey: true,
});

export async function POST(req: Request) {
  const { prompt } = await req.json();

  // Sanitize at the edge (< 0.1 ms, no network hop)
  const result = shield.sanitize(prompt);

  const { text } = await generateText({
    model: __MODEL__,
    prompt: result.sanitizedInput,
  });

  return Response.json({
    text,
    shieldMetrics: {
      piiDetected: result.piiDetected,
      maskedTypes: result.maskedTypes,
      latencyMs: result.latencyMs,
    },
  });
}
```

For streaming chat routes, sanitize each user message before you pass `messages` to `streamText`:

```tsx filename='app/api/chat/route.ts'
import { createNexusShield } from '@baturhantasdelen/nexus-shield-edge';
import {
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from 'ai';
__PROVIDER_IMPORT__;

export const runtime = 'edge';

const shield = createNexusShield();

export async function POST(req: Request) {
  const { messages } = await req.json();

  const sanitizedMessages = messages.map(
    (message: { role: string; content: string }) => {
      if (message.role !== 'user') {
        return message;
      }

      const result = shield.sanitize(message.content);
      return { ...message, content: result.sanitizedInput };
    },
  );

  const result = streamText({
    model: __MODEL__,
    messages: sanitizedMessages,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
```

## Cloudflare Workers integration

Use `nexusShieldMiddleware` to sanitize JSON request bodies before you forward them to an upstream LLM API. The middleware walks common prompt fields (`prompt`, `content`, `messages`, and nested strings) and returns a rewritten `Request`.

```ts filename='src/index.ts'
import { nexusShieldMiddleware } from '@baturhantasdelen/nexus-shield-edge';

export default {
  async fetch(request: Request): Promise<Response> {
    const { request: cleanRequest, shieldResult } =
      await nexusShieldMiddleware({
        maskTCKN: true,
        maskCreditCard: true,
        maskEmail: true,
        maskAPIKey: true,
      })(request);

    const upstream = await fetch(
      'https://api.openai.com/v1/chat/completions',
      cleanRequest,
    );

    if (shieldResult?.piiDetected) {
      console.log('PII masked:', shieldResult.maskedTypes);
    }

    return upstream;
  },
};
```

## Configuration options

| Option | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `maskTCKN` | `boolean` | `true` | Redacts Turkish national ID numbers |
| `maskCreditCard` | `boolean` | `true` | Redacts Visa, Mastercard, and AMEX patterns |
| `maskEmail` | `boolean` | `true` | Redacts email addresses |
| `maskPhone` | `boolean` | `true` | Redacts phone numbers |
| `maskAPIKey` | `boolean` | `true` | Redacts leaked API keys (OpenAI, GitHub, AWS, Slack) |
| `customRules` | `CustomRule[]` | `[]` | Custom regex patterns and replacement labels |

Pass options to `createNexusShield` or `nexusShieldMiddleware`:

```ts
const shield = createNexusShield({
  maskEmail: true,
  customRules: [
    {
      pattern: /\bSECRET-[A-Z0-9]{8}\b/g,
      replacement: '[SECRET_REDACTED]',
      label: 'SECRET',
    },
  ],
});
```

## Learn more

- [Language Model Middleware](/docs/ai-sdk-core/middleware) — filter model output with `wrapLanguageModel`
- [Rate Limiting](/docs/advanced/rate-limiting) — protect API routes from abuse
- [Package on npm](https://www.npmjs.com/package/@baturhantasdelen/nexus-shield-edge)
- [Source on GitHub](https://github.com/baturhantasdelen-sudo/core-ai-firewall/tree/main/packages/edge)
````

---

## Optional: Community Middleware cross-link

Add this bullet under **Community Middleware** in `content/docs/03-ai-sdk-core/40-middleware.mdx`:

```mdx
### Edge-native input guardrails

The [@baturhantasdelen/nexus-shield-edge](https://www.npmjs.com/package/@baturhantasdelen/nexus-shield-edge) package redacts PII in user prompts at the edge before they reach an LLM. See the [Edge-native guardrails](/docs/advanced/guardrails) guide for Next.js and Cloudflare Workers examples.
```

---

## How to open the PR

```bash
# Fork vercel/ai, then:
git clone https://github.com/<your-user>/ai.git
cd ai
git checkout -b docs/nexus-shield-edge-guardrails

# Add the MDX file
mkdir -p content/docs/06-advanced
# Paste 12-guardrails.mdx from this document

git add content/docs/06-advanced/12-guardrails.mdx
git commit -m "docs(guides): add @baturhantasdelen/nexus-shield-edge to AI SDK guardrails guide"
git push -u origin docs/nexus-shield-edge-guardrails

gh pr create --repo vercel/ai \
  --title "docs(guides): add @baturhantasdelen/nexus-shield-edge to AI SDK guardrails guide" \
  --body-file PR_DESCRIPTION.md
```

Save the **PR description** section above as `PR_DESCRIPTION.md` in your fork before running `gh pr create`.
