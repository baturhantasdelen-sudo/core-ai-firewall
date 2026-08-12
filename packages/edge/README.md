# @baturhantasdelen/nexus-shield-edge

Sub-10ms in-RAM PII redaction for **Vercel Edge Runtime** and **Cloudflare Workers**. No network hop — patterns run locally at the edge before prompts reach an LLM.

## Install

```bash
npm install @baturhantasdelen/nexus-shield-edge
```

## Next.js App Router & Vercel AI SDK

`app/api/chat/route.ts`:

```typescript
import { createNexusShield } from '@baturhantasdelen/nexus-shield-edge';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const runtime = 'edge';

const shield = createNexusShield({
  maskTCKN: true,
  maskCreditCard: true,
  maskEmail: true,
});

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const result = shield.sanitize(prompt);

  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt: result.sanitizedInput,
  });

  return Response.json({ text, shieldMetrics: result });
}
```

## Cloudflare Workers Middleware

```typescript
import { nexusShieldMiddleware } from '@baturhantasdelen/nexus-shield-edge';

export default {
  async fetch(request: Request) {
    const { request: cleanRequest, shieldResult } = await nexusShieldMiddleware({
      maskTCKN: true,
      maskCreditCard: true,
    })(request);

    return fetch('https://api.openai.com/v1/chat/completions', cleanRequest);
  },
};
```

## Configuration

| Option | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `maskTCKN` | `boolean` | `true` | Redacts Turkish National ID numbers |
| `maskCreditCard` | `boolean` | `true` | Redacts Visa, Mastercard, AMEX |
| `maskEmail` | `boolean` | `true` | Redacts email addresses |
| `maskPhone` | `boolean` | `true` | Redacts phone numbers |
| `maskAPIKey` | `boolean` | `true` | Redacts leaked API keys (OpenAI, GitHub, AWS, Slack) |
| `customRules` | `CustomRule[]` | `[]` | Custom regex patterns and replacement labels |

## License

MIT © Nexus Shield Team
